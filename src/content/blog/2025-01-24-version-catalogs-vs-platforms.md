---
title: "Choosing Between Gradle Version Catalogs and Dependency Platforms: A Guide for Application Developers"
description: "In this blog post we'll break down the differences between Version Catalogs and Platforms."
pubDate: "2025-01-24"
image: "gradle-dependencies.png"
---

Managing dependencies effectively is a critical part of any application's development process.
[Gradle](https://gradle.org) provides two features when it comes to dependency management: [Version Catalogs](https://docs.gradle.org/current/userguide/version_catalogs.html) and [Dependency Platforms](https://docs.gradle.org/current/userguide/platforms.html) (referred to simply as "Platforms" for the remainder of this post).
While Version Catalogs help to centralize dependency coordinates, Platforms are used to ensure that all dependencies in a project align with a consistent set of versions.

In this blog post, we’ll break down the differences between these two features, and explore their use cases.
Because Version Catalogs and Platforms are used differently when building a library or a framework compared to building an application, we'll focus specifically on dependency management for application engineers.

:::note
Experienced Gradle build authors may notice that I've intentionally left out certain details throughout this post.
This was done to avoid overwhelming readers with unnecessary complexity.
For those interested, I've included footnotes to highlight areas where details were simplified for clarity.
:::

## Understanding Version Catalogs

Version Catalogs are a relatively recent feature designed to centralize and standardize the management of dependencies across your project.
It provides a single location to declare dependency versions, aliases, and even plugin coordinates, making it easier to keep your build configuration consistent and maintainable.

In order to make the remainder of the post easier to follow, suppose we have the following build script in our project:

```kotlin
// app/build.gradle.kts
plugins {
    id("org.gradlex.jvm-dependency-conflict-resolution") version "2.1.2"
}

dependencies {
    implementation("org.codehaus.groovy:groovy:3.0.5")
    implementation("org.codehaus.groovy:groovy-json:3.0.5")
    implementation("org.codehaus.groovy:groovy-nio:3.0.5")
    implementation("org.apache.commons:commons-text:1.13.0")
}
```

With Version Catalogs, we can centralize the dependency coordinates in a `libs.versions.toml` file in the `gradle/` folder of the project.[^1]
In the build scripts, instead of repeating the same dependency coordinate string, we reference catalog entries using a generated accessor.
This has several advantages over plain string declarations:

[^1]:
    The `gradle/lib.versions.toml` file is a convention that Gradle automatically sets up.
    Build authors can use a DSL in the settings script to define Version Catalogs programatically, use a different TOML file, or import multiple files at once.

- Since Gradle generates accessors for the catalog entries, your IDE can make suggestions for which dependencies are available.
- If you misstype an accessor name, it results in a compile error during build script compilation. This makes typos in dependency declarations much easier to catch.
- Since dependency coordinates are centralized you don't end up with multiple build scripts defining a dependency to different versions of a particular library anymore - a problem that often occurs in large builds with lots of subprojects.
- Using a standardized [TOML](https://toml.io/en/) format has the advantage of being easier to automatically update by tools like [Dependabot](https://docs.github.com/en/code-security/dependabot).[^2]

[^2]: While Dependabot is quite limited in it's ability to update Gradle dependencies, [Renovate](https://www.mend.io/renovate/) is capable of finding Gradle dependency definitions even in deeply nested project hierarchies and updating them reliably.

Let's look at a Version Catalog for replacing the dependency coordinates in the build script:

```toml
# gradle/libs.versions.toml
[versions]
groovy = "3.0.5"

[libraries]
groovy-core = { module = "org.codehaus.groovy:groovy", version.ref = "groovy" }
groovy-json = { module = "org.codehaus.groovy:groovy-json", version.ref = "groovy" }
groovy-nio = { module = "org.codehaus.groovy:groovy-nio", version.ref = "groovy" }
commons-text = { module = "org.apache.commons:commons-text", version = "1.13.0" }

[plugins]
dependencyConflicts = { id = "org.gradlex.jvm-dependency-conflict-resolution", version = "2.1.2" }
```

Here we can see several Version Catalog features:[^3]
The `[libraries]` block contains the catalog entries.
Each catalog entry consists of a name and a definition, which includes the module coordinates (group ID and artifact ID) along with a version.
Dependency versions can either be declared in the catalog entry (as for `commons-text`), or be defined in the `[versions]` block if there are multiple entries sharing the same version.[^4]
Plugin IDs can also be defined in the version catalog, but need to go to the `[plugins]` section instead of `[libraries]`.

[^3]:
    I've omitted the `[bundle]` feature here, because it adds indirection that I find more confusing than helpful.
    You can read more about this feature in the [official documentation](https://docs.gradle.org/current/userguide/version_catalogs.html#sec:version-catalog-declaration).

[^4]:
    I need to note here, that versions in the catalog don't have to be simple strings.
    It's also possible to use [rich versions](https://docs.gradle.org/current/userguide/dependency_versions.html#sec:rich-version-constraints), but in my opinion there's seldom a need to do this when developing an application.

Using the provided Version Catalog, we can create a build script like this:

```kotlin
// app/build.gradle.kts
plugins {
    alias(libs.plugins.dependencyConflicts)
}

dependencies {
    implementation(libs.groovy.core)
    implementation(libs.groovy.json)
    implementation(libs.groovy.nio)
    implementation(libs.commons.text)
}
```

As you can see there are no dulicated strings anymore.
This is not only true for the versions, but also for the coordinates.
For example if we wanted to upgrade from Groovy 3 to Groovy 4, which involces changing the cooridnates from `org.codehaus.groovy` to `org.apache.groovy`, we would only need to change the catalog without modifying any build scripts.

:::note
Gradle imposes minimal restrictions on the naming of catalog entries.
In the example above, I used `commons-text` to represent the coordinates of the [Apache Commons Text](https://commons.apache.org/text) library.
But why didn't I choose something like `apache-commons-text`, or `org-apache-commonsText`?
All of these options are valid, and each project is free to define its own conventions for deriving catalog entry names from dependency coordinates.
However, after encountering numerous inconsistencies in version catalogs and the recurring debates they sparked, I decided to write a [blog post](https://blog.gradle.org/best-practices-naming-version-catalog-entries) summarizing the method I use to derive entry names.
:::

## Understanding Platforms

Now that we’ve explored Version Catalogs, let’s turn our attention to Platforms.
Many application developers are likely already familiar with Platforms, as frameworks like [Spring Boot](https://spring.io/projects/spring-boot) or [Micronaut](https://micronaut.io/) provide BOMs (Bill of Materials) that can be imported into a Gradle build using the Platform feature.[^5]
Importing a BOM as a Platform is done with the `platform` method in the build script.[^6]
We’ll look at an example of this shortly, after we define our own Platform.

[^5]: In fact Micronaut even comes with a [published Version Catalog](https://micronaut-projects.github.io/micronaut-gradle-plugin/latest/#sec:micronaut-platform-catalog-plugin) that can be imported into the project so it's easier to work with dependencies managed by the framework.

[^6]: There's a second method called `enforcedPlatform`, see [the documentation](https://docs.gradle.org/current/userguide/platforms.html#sec:enforced-platform) for more details.

To define a Platform we need to add a new subproject to our build.
The new subproject has to apply the `java-platform` plugin and the dependencies blog should only define dependency constraints:[^7]

[^7]:
    Platforms can also contain regular dependency declarations.
    This is for importing other platforms or for making a platform add dependencies when it is referenced.
    This way you can for example make your platform always bring in the dependency to the testing framework of your choise.

```kotlin
// dependencies/build.gradle.kts
plugins {
    id("java-platform")
}

dependencies {
    constraints {
        api("org.codehaus.groovy:groovy:3.0.5")
        api("org.codehaus.groovy:groovy-json:3.0.5")
        api("org.codehaus.groovy:groovy-nio:3.0.5")
        api("org.apache.commons:commons-text:1.13.0")
    }
}
```

With our dependencies managed by the new Platform, we can now change the build script from the beginning like this:

```kotlin
// app/build.gradle.kts
plugins {
    id("org.gradlex.jvm-dependency-conflict-resolution") version "2.1.2"
}

dependencies {
    implementation(platform(project(":dependencies")))
    implementation("org.codehaus.groovy:groovy")
    implementation("org.codehaus.groovy:groovy-json")
    implementation("org.codehaus.groovy:groovy-nio")
    implementation("org.apache.commons:commons-text")
}
```

Compared to using a Version Catalog, we had to add an additional dependency statement to the `dependencies` bock, we've lost the ability to manage plugin versions, and we still need to duplicate dependency data such das the group ID of the Groovy dependencies.
So why would we choose a Platform over a Version Catalog?

## The Difference

At first glance, it might seem like Platforms are unnecessary if you’re already using a Version Catalog.
However, there’s one crucial aspect we haven’t discussed yet: controlling transitive dependencies.
What happens if a critical vulnerability is discovered in one of those transitive dependencies? For instance, [Apache Commons Text depends on Apache Commons Lang3](https://commons.apache.org/proper/commons-text/dependencies.html).
Now imagine a severe vulnerability is found in Apache Commons Lang version 3.17.0, which is the version used by Apache Commons Text 1.13.0.

Using the Platform that we've defined in the previous section we can easily force on upgrade of the Apache Commons Lang3 dependency by adding the following to the `constrains` block:

```kotlin
// dependencies/build.gradle.kts
dependencies {
    constraints {
        // other constraints
        api("org.apache.commons:commons-lang3") {
            version {
                require("3.13.1")
            }
        }
    }
}
```

The `require` declaration for version 3.13.1 tells Gradle the version for Apache Commons Lang3 cannot be lower than 3.13.1, but it can be higher if there's another transitive dependency to Apache Commons Lang3 asking for a higher version.[^8]
We don't need to add anything to the build script that depends on Apache Commons Text, because importing the Platform automatically adds the constraint.
This applies to all occurences of Apache Commons Lang3.
So even if we added another dependency that depends on Apache Commons Lang3 transitively, Gradle will apply the constraint and make sure the version cannot be lower than 3.13.1.

[^8]:
    Using `prefer` is just one way of solving this situation.
    Gradle's rich versions provide a lot of flexibility in how Gradle resolves version conflicts.
    Check the [documentation](https://docs.gradle.org/current/userguide/dependency_versions.html#sec:rich-version-constraints) for more information.

Now let's go back to Version Catalogs and discuss would we could do.
What happens if we add Apache Commons Lang3 3.13.1 to the catalog like so:

```toml
# gradle/libs.versions.toml
[libraries]
commons-lang3 = { module = "org.apache.commons:commons-lang3", version = "3.13.1" }
```

Well, nothing would happen!
This is because the Version Catalog just replaces dependency declarations but does not manage transitive dependencies.
We would have to explicitly add the dependency to our build script:

```kotlin
// app/build.gradle.kts
dependencies {
    // other dependencies ommitted
    implementation(lib.commons.text)
    implementation(lib.commons.lang3)
}
```

This unnecessarily clutters the build script since we don't use Apache Commons Lang3 which is an implementation detail of Apache Commons Text.
Furthermore this approach of managing transitive dependencies by adding them as direct dependencies does not scale in larger projects due to the amount of transtive dependencies found in a typical dependency graph.

:::important
Version Catalogs are a _dependency declaration_ feature.
They help with how you declare dependencies in your build scripts.

Platforms are a _dependency alignment_ feature.
They help with controlling dependencies in your dependency graph, even those that you haven't explicitly mentioned in any of your build scripts.
:::

This distinction is very important since it helps you to choose the right tool for your situation.
If you want to unclutter your build scripts and centralize dependency coordinates, use a Version Catalog.
If you want to manage versions of your (transitive) dependencies, use a Platform.
Of corse it's also possible to combine the two features:
Use a catalog to centralize dependency coordinate declarations, and use a Platform for controlling transitives.

## Conclusion

In this blog post, we’ve explored the key differences between Gradle Version Catalogs and Platforms.
The most important takeaway is that Version Catalogs are a dependency declaration feature—they simplify and organize how you declare dependencies in your build scripts.
In contrast, Platforms are a dependency alignment feature—they control the versions of dependencies across your dependency graph, including those you haven’t explicitly declared in your build scripts.
By understanding these distinctions, you can choose the right tool for managing dependencies in your Gradle projects more effectively.
If you’re looking for expert guidance or need help with your Gradle builds, I offer [consulting services](/services) and would be happy to assist!
