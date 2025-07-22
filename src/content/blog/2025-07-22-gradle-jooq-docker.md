---
title: "Optimizing Gradle Builds with Dockerized Databases, Flyway, and jOOQ"
description: "How using a custom Gradle build service and rethinking task dependencies led to faster, cleaner builds in a Java backend project using Docker, Flyway, and jOOQ."
pubDate: "2025-07-22"
image: "gradle-docker-flyway.png"
---

In one of my side projects, I’m building a Java backend using [jOOQ](https://jooq.org) for type-safe SQL access and [Flyway](https://github.com/flyway/flyway) for database migrations.
I wanted my build process to be as hands-off as possible—meaning code generation and migrations should run automatically and reliably when needed, without manual intervention.

This led me to an interesting journey with [Gradle](https://gradle.org), [Docker Compose](https://docs.docker.com/compose/), and build optimizations I didn’t expect to make. This post walks through the setup, the pitfalls I ran into, and how a small shift in approach made a big difference.

## The Setup: jOOQ, Flyway, and Docker Compose

My application is built with [Spring Boot](https://spring.io/projects/spring-boot) which automatically applies Flyway migrations to the production database, when the application starts after a deployment.
The persistence layer is implemented using jOOQ, with Flyway managing schema migrations.
To generate jOOQ's Java code from the current database schema, I needed a live Postgres instance.
Rather than managing this manually, I used a Docker Compose file to define and spin up the database:

```yaml
services:
  database:
    image: "postgres:17-alpine"
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: "postgres"
```

While a Docker Compose file for a single service may seem like overkill, I like the convenience it provides over raw `docker run` commands, such as automatic naming of containers, and encoding exposed flags, and environment variables.

Now, what I've seen a lot of people do in order to have the database container running during the build is using the excellent [gradle-docker-plugin](https://github.com/bmuschko/gradle-docker-plugin) by fellow Gradle expert [Benjamin Muschko](https://bmuschko.com/).
While this plugin is great for what is does, it implements all interactions with docker based on tasks.
Unfortunately this leads to a lot of weird task wiring when trying to make sure `docker run` and `docker stop` are called at appropriate times during the build lifecycle.
This becomes especially challenging when trying to make sure no dangling containers are left over in case the build is killed have way through.

Luckily, in recent Gradle versions there's a more appropriate abstraction to make sure some service is available during task execution time and will be terminated once it's not needed anymore or the build stops unexpectedly: [Build Services](https://docs.gradle.org/current/userguide/build_services.html).
So to orchestrate this inside my Gradle build, I created a custom Gradle build service that shells out to `docker compose up` and `docker compose down`.

```kotlin
import java.io.ByteArrayOutputStream
import javax.inject.Inject
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.services.BuildService
import org.gradle.api.services.BuildServiceParameters
import org.gradle.process.ExecOperations

abstract class DockerComposeService : BuildService<DockerComposeService.Parameters>, AutoCloseable {

    @get:Inject protected abstract val exec: ExecOperations

    interface Parameters : BuildServiceParameters {
        val composeFile: RegularFileProperty
    }

    init {
        exec.exec {
            commandLine(
                "docker",
                "compose",
                "--file",
                parameters.composeFile.get().asFile,
                "up",
                "--detach",
                "--quiet-pull",
            )
        }

        val stdOut = ByteArrayOutputStream()
        while (!stdOut.toString().contains("database system is ready to accept connections")) {
            stdOut.reset()
            exec.exec {
                commandLine(
                    "docker",
                    "compose",
                    "--file",
                    parameters.composeFile.get().asFile,
                    "logs",
                    "database",
                )
                this.standardOutput = stdOut
            }
            Thread.sleep(200)
        }
    }

    override fun close() {
        exec.exec {
            commandLine(
                "docker",
                "compose",
                "--file",
                parameters.composeFile.get().asFile,
                "down",
            )
        }
    }
}
```

This service was shared between the Flyway and jOOQ tasks, allowing both to access the temporary database without each re-spawning it:

```kotlin
plugins {
    id("org.flywaydb.flyway")
    id("org.jooq.jooq-codegen-gradle")
}

flyway {
    url = "jdbc:postgresql://localhost/postgres?user=postgres&password=postgres"
}

jooq {
    configuration {
        jdbc {
            url = flyway.url
        }
    }
}

tasks.compileJava { dependsOn(tasks.jooqCodegen) }

tasks.withType<AbstractFlywayTask>().configureEach {
    notCompatibleWithConfigurationCache("https://github.com/flyway/flyway/issues/3901")
    requireDatabaseService()
}

tasks.jooqCodegen {
    dependsOn(tasks.flywayMigrate)
    requireDatabaseService()
}

fun Task.requireDatabaseService() {
    val service = gradle.sharedServices.registerIfAbsent("database-service", DockerComposeService::class) {
        parameters {
            composeFile.convention(layout.projectDirectory.file("docker-compose.yaml"))
        }
    }
    usesService(service)
    doFirst { service.get() }
}
```

Everything worked, although I wasn't too happy about the fact that none of the Flyway tasks provided by the Flyway plugin are compatible with Gradle's [configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html).
But then I noticed something off.

## The Problem: Unnecessary Docker Spins

Even when my build output was up-to-date—meaning no code changes, no schema changes—Gradle would still start the Dockerized database.
In fact it would also always run the Flyway migrations to bring the pristine database schema into the lastest state defined by my migration scripts.
Why? I had not changed or added any migrations and the generated jOOQ code was en par with the state of the database defined by the migration scripts.

The reason is actually quite obvious as soon as you start thinking about how [up-to-date checking](https://docs.gradle.org/current/userguide/gradle_optimizations.html#incremental_builds) works in Gradle.
When Gradle has to execute a task, it first checks whether there's already an output for that task in the task's output location(s).
If that is the case and none of the inputs have changed, Gradle considers the task up to date and skips its execution.
Task inputs and outputs are always based on simple values such as numbers, and strings, or based on files and directories on the file system.
Now, think about the Flyway task.
What is its input? Well, it's migration files, for sure. But it's also the current state of the database. The same goes for the task's output. It's the final state of the database after the migrations have been applied.
This is something that can not be easily tracked by Gradle, so the plugin authors opted for the secure path of marking this task as not up-to-datable (if that is a word).

For my project that meant that although everything was up to date form the build's perspective - all the database access code was generated and matching the latest database state as defined by the migration script - the build would still spin up the database and execute the migrations.

That might seem like a small issue, but for iterating quickly this became problematic rather quickly because each check-compile-test cycle required spinning up the database, even if only test classes had changed.
On top of that due to the fact that the Flyway plugin was not configuration cache compatible I had to pay the price of configuring the build each time I made a change to the application code.

## The Fix: Rethinking Task Ownership

To avoid this, I decided to collapse the responsibility into a single task: the jOOQ code generation task, and define my own more narrow notion of what up to date means for the Flyway execution.

Here’s what I changed:

- I removed the Flyway Gradle plugin from the build entirely.
- Instead, I embedded Flyway directly into the jOOQ task, using Flyway’s Java API.
- I added the Flyway execution as a `doFirst` action within the jOOQ task.
- I defined the jOOQ task's up to date state based on the directory containing the the flyway migration scripts.

The last item is the change that made the rest of the story possible.
The Flyway plugin has to account for all sorts of use cases, such as running migrations and roll backs on a persistent database from Gradle (it sounds crazy, but apparently some people do it).
For that reason it can not assume any up to date state (as discussed above).
But in my project I know that Flyway always communicates with a pristine database and that it will always execute all migrations.
For that reason I can define up to dateness based on the contents of the migration scripts folder.

Here's how my build looked like after applying these changes:

```kotlin
import org.flywaydb.core.Flyway
import org.flywaydb.core.internal.configuration.ConfigUtils

plugins {
    id("org.jooq.jooq-codegen-gradle")
}

val dbURL = "jdbc:postgresql://localhost/postgres?user=postgres&password=postgres"
val dbMigrationFolder = layout.projectDirectory.dir("src/main/resources/db/migration")

jooq {
    configuration {
        jdbc { url = dbURL }
    }
}

tasks.compileJava { dependsOn(tasks.jooqCodegen) }

tasks.jooqCodegen {
    val service = gradle.sharedServices.registerIfAbsent("database-service", DockerComposeService::class) {
        parameters {
            composeFile.convention(layout.projectDirectory.file("docker-compose.yaml"))
        }
    }
    usesService(service)
    inputs.dir(dbMigrationFolder)
    caching = true

    // need to capture values for Configuration Cache
    val url = dbURL
    val locations = dbMigrationFolder.asFile.absolutePath

    doFirst {
        service.get()
        val config =
            mapOf(
                ConfigUtils.URL to url,
                ConfigUtils.LOCATIONS to "filesystem:${locations}",
            )
        Flyway.configure().configuration(config).load().migrate()
    }
}
```

## Why This Works Better

Gradle evaluates whether a task needs to run based on inputs, outputs, and configuration. If those haven't changed, the task is skipped.
Build services are only started if any of the tasks in the task graph that uses them is executed.

By consolidating the Flyway call into the jOOQ task:

- There's less complexity in the task wiring, because there's only a single task that interacts with the database.
- The service lifecycle is only triggered if that one task runs.
- That task's up to date checking works based on simple values and files. The files serve as a proxy for Flyway's up-to-dateness because in my case I know that's good enough.

As a bonus I've now resolved the configuration cache issue because the jOOQ task is compatible with the configuration cache and I implemented my additions in a configuration cache compatible way.

:::tip
My key takeaway here is not to blindly apply plugins to my build anymore if they are available.
Instead I'm going to review their code and make a decision whether it's really worth the additional headaches to introduce a new plugin.
Plugins often have to account for a number of different use cases which makes their implementation complex.
In my case I could replace the Flyway plugin with just five lines of configuring and executing Flyway myself.
:::

## Curious to Hear From You

Have you faced similar issues when integrating database tasks into your build? Have you gone deeper into Gradle build services or optimized task graphs in other ways? Let me know—I’d love to hear how others are solving these problems.
And in case you need help optimizing your Gradle builds, I offer [consulting services](/services/gradle) for Gradle Build tool. Feel free to reach out!
