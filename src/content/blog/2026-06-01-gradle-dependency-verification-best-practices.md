---
title: "Best Practices for Gradle Dependency Verification"
description: "A set of best practices for setting up and maintaining Gradle dependency verification, distilled from real-world experience at GradleX and a few additional lessons learned along the way."
topics: ["Gradle", "Dependency Management"]
---

Last year I wrote a [practical guide](/blog/2025/02/10/gradle-dependency-verification) on enabling [Gradle](https://gradle.org) [dependency verification](https://docs.gradle.org/current/userguide/dependency_verification.html) for the [GradleX](https://gradlex.org) projects.
The guide walks through the full setup process step by step and discusses the compromises we made along the way.
In this post I want to take a step back and distill that experience into a short list of best practices.
I'm also adding a few recommendations that didn't make it into the original guide, but that I've come to rely on since.

The thread running through all of them is the same: changes to `verification-metadata.xml` should be rare.
If every Renovate PR touches the file, it becomes one of those files we stop looking at too closely.
That's exactly the opposite of what we want.
Each change should ring alarm bells, requiring close human review to confirm it's legitimate.
This is not a job for robots or AI.

If you're starting from scratch, the [original post](/blog/2025/02/10/gradle-dependency-verification) is still the place to begin.
This post assumes you've already enabled dependency verification and want to make sure your setup stays maintainable over time.

## Prefer PGP Signatures Over Artifact Checksums

Whenever an artifact is signed with a PGP key, prefer trusting the key over recording a checksum for the artifact.
The reason is maintenance: a `<trusted-key>` entry covers all artifacts signed by that key, so a dependency update doesn't require touching the verification metadata at all.
A checksum entry, on the other hand, has to be updated for every new release.

Fall back to checksums only when there is no signature available, which in practice happens most often for plugins from the [Gradle Plugin Portal](https://plugins.gradle.org).

:::note
The trade-off, as [Cédric Champeau pointed out](/blog/2025/02/10/gradle-dependency-verification/#removing-unnecessary-checksums) on my previous post: a `<trusted-key>` entry assumes the signing key hasn't been compromised, while a per-release checksum would still catch a malicious release signed with a stolen key, because the bytes differ between releases.
If your threat model requires catching that case, pin trusted keys to specific versions, or stick with checksums and accept the higher maintenance cost.
:::

The next two practices follow naturally from this decision.
Once you're trusting PGP keys, you're managing a keyring, and the format you store it in and the way Gradle obtains keys both become trust decisions worth making explicitly.

## Use the Armored Keyring Format

Gradle supports two keyring formats: a binary `.gpg` file, and an ASCII-armored `.keys` file.
The armored format is plain text, which means it produces readable diffs in code review and is easy to inspect or edit by hand.
The binary format produces opaque diffs that nobody on your team will meaningfully review.

Configure the armored format in the `<configuration>` block:

```xml
<keyring-format>armored</keyring-format>
```

After that, you can delete the binary `verification-keyring.gpg` file and never look back.

## Disable Key Server Requests

By default, Gradle queries public key servers to fetch keys it doesn't have locally.
This causes two problems.
First, key server lookups are slow and add noticeable latency to dependency resolution.
Second, key servers were not designed to handle high volumes of automated requests, and they will rate-limit or block you if you query them too often.

The fix is to disable key server lookups entirely and manage the keyring yourself:

```xml
<key-servers enabled="false"/>
```

Disabling key servers also forces you to think about which keys you trust.
When Gradle silently pulls a key from a key server, you have implicitly accepted that key as trustworthy.
By managing the keyring manually, you stay in control of the trust decisions in your build.

## Annotate the verification-metadata.xml File

A `verification-metadata.xml` file with a few hundred trusted keys and components quickly becomes opaque.
Six months after you wrote it, you won't remember which key belongs to which library, who controls it, or how confident you were in the trust decision at the time.

Add comments to your verification metadata to document this context.
The [GradleX reproducible-builds project](https://github.com/gradlex-org/reproducible-builds/blob/main/gradle/verification-metadata.xml) is a good example of how to do this.
It uses two patterns worth copying:

**Section headers** group keys by purpose, so it's easy to find related entries:

```xml
<!-- TESTING - JUnit, AssertJ, and Gradle Exemplar with transitive dependencies -->
<!-- ✅ Signed by JUnit - Marc Philipp -->
<trusted-key id="FF6E2C001948C5F2F38B0CC385911F425EC61B51">
   <trusting group="junit"/>
   <trusting group="org.junit.jupiter"/>
   <trusting group="org.junit.platform"/>
</trusted-key>
```

**Confidence indicators** flag entries where you weren't fully sure who signed an artifact:

```xml
<!-- 🤔 Signed by ??? -->
<trusted-key id="..." group="..." name="..."/>
```

A `🤔` next to an entry is a reminder to yourself (and your reviewers) that the trust decision was made under uncertainty.
It's an open invitation for somebody to follow up later and either confirm the signer or replace the entry with a stricter alternative.

The exact emoji or wording doesn't matter.
What matters is that the file documents not just what is trusted, but why.
That context is what makes the file reviewable when [Renovate](https://www.mend.io/renovate/) proposes a change six months from now.

## Ensure Reproducible Dependency Resolution

This best practice didn't make it into my original guide, but it's the one I'd add at the top of the list if I were writing it today.

Gradle generates the verification metadata by resolving your project's dependency graph and recording the resulting artifacts.
If that resolution is not reproducible, the metadata file describes a graph that may not exist tomorrow.
The next time you resolve dependencies, Gradle may pull in different versions, and verification will fail against the now-stale metadata.

The most common way this happens is version ranges introduced by transitive dependencies.
I hit this myself trying to rebuild Kotlin stdlib 2.3.0 from source, and [reported it](https://github.com/gradle/gradle/issues/37915) against Gradle.
BouncyCastle entered the dependency graph through a transitive range like `org.bouncycastle:bcprov-jdk18on:[1.80,1.81)`, which resolved to `1.80` at the time the verification metadata was first generated.
When BouncyCastle `1.80.2` was published later, the same range resolved to it instead, but the metadata still only had a checksum for `1.80`, and the build failed with a verification error.
Nothing in the Kotlin project's own dependency declarations had changed in the meantime.
The verification metadata had silently become a record of "what was true when I last ran the command," not "what my build actually resolves to."

The fix is to make dependency resolution reproducible.
Gradle gives you two ways to do this, and either one is enough on its own.

### Option 1: Fail On Non-Reproducible Resolution

The approach I prefer is to outright reject any non-reproducible inputs to dependency resolution.
[`ResolutionStrategy.failOnNonReproducibleResolution()`](https://docs.gradle.org/current/javadoc/org/gradle/api/artifacts/ResolutionStrategy.html#failOnNonReproducibleResolution--) makes the build fail if it encounters dynamic versions (like `1.+`), changing versions (like `-SNAPSHOT`), or version ranges anywhere in the dependency graph.
This applies to the whole graph, not just to the dependencies you declare directly, so it catches the exact case described in issue [#37915](https://github.com/gradle/gradle/issues/37915).

You can enable it for all configurations like this:

```kotlin
configurations.configureEach {
    resolutionStrategy.failOnNonReproducibleResolution()
}
```

I consider this a good practice independently of dependency verification.
Reproducible dependency resolution is something you want regardless: an upgraded transitive dependency may silently change the behavior of your application or, worse, introduce a bug.
`failOnNonReproducibleResolution()` forces you to make an explicit decision for every node in the graph where there is ambiguity, rather than letting Gradle pick something for you at resolution time.

The right way to resolve those ambiguities is to declare a [strict version constraint](https://docs.gradle.org/current/userguide/dependency_versions.html#sec:strict-version) for the offending dependency:

```kotlin
dependencies {
    constraints {
        implementation("org.bouncycastle:bcprov-jdk18on") {
            version {
                strictly("1.80")
            }
        }
    }
}
```

For larger projects, declaring strict constraints in every subproject quickly becomes unwieldy.
In that case, introduce a [dependency platform](/blog/2025/01/24/version-catalogs-vs-platforms) that serves as the central place of truth for the versions of all transitive dependencies in your build.
Each subproject then depends on the platform and inherits the pinned versions from there, without having to repeat constraints locally.

### Option 2: Dependency Locking

If you don't want to make an explicit decision for every ambiguity in the graph, [dependency locking](https://docs.gradle.org/current/userguide/dependency_locking.html) is the alternative.
Dependency locking captures the exact resolved versions of all dependencies in a `gradle.lockfile` and enforces those versions on every subsequent resolution.
Once locked, dynamic versions are pinned and version ranges resolve to a fixed point, regardless of what new versions are published upstream.

Enable it for all configurations in your build:

```kotlin
dependencyLocking {
    lockAllConfigurations()
}
```

Then generate the lockfile alongside the verification metadata:

```bash
./gradlew dependencies --write-locks
```

Commit `gradle.lockfile` to version control, and from then on the verification metadata and the lockfile describe the same dependency graph.
When you want to update dependencies, you regenerate both files together.

:::warning
Dependency locking [doesn't help with changing versions](https://docs.gradle.org/current/userguide/dependency_locking.html#sec:dependency-locking) like `-SNAPSHOT`.
The coordinates stay the same while the content underneath can change, so locking the version doesn't pin the actual bytes.
This is another point in favor of `failOnNonReproducibleResolution()`, which rejects `-SNAPSHOT` outright instead of silently letting it through the lockfile.
:::

The trade-off is that locking just snapshots whatever Gradle happened to resolve at the time you ran `--write-locks`.
You get reproducibility, but not the explicit "I have thought about this version" signal that strict constraints give you.
That's why I'd reach for `failOnNonReproducibleResolution()` plus strict constraints first, and fall back to locking only when the cost of declaring constraints for every ambiguous dependency outweighs the benefit.

## Bonus: Dependency Hygiene

The size of your `verification-metadata.xml` file is directly proportional to the number of artifacts in your dependency graph.
Every transitive dependency is one more component to record, one more potential key to manage, and one more entry to revisit when a dependency update touches it.
The fewer dependencies you pull in, the less there is to maintain.

The single biggest lever for keeping the dependency graph small is the [org.gradlex.jvm-dependency-conflict-resolution](https://gradlex.org/jvm-dependency-conflict-resolution) plugin.
The JVM ecosystem has accumulated a lot of components that provide the same functionality under different coordinates.
For example, `jsr311-api`, `javax.ws.rs-api`, `jakarta.ws.rs-api`, and `jboss-jaxrs-api_2.1_spec` all ship overlapping JAX-RS classes.
The same pattern shows up in the `javax` to `jakarta` namespace split across many other APIs, in the long history of conflicting SLF4J bindings, and in libraries that have been renamed or relocated over the years.
Without intervention, your dependency graph happily resolves two or three components for the same job, and your verification metadata records keys and checksums for all of them.

The plugin uses Gradle's [capabilities](https://docs.gradle.org/current/userguide/component_capabilities.html) feature to declare that these components are interchangeable, so Gradle picks one and rejects the rest at resolution time.
It ships rules for over 100 well-known JVM libraries out of the box, so most of the cleanup is automatic once you apply the plugin:

```kotlin
plugins {
    id("org.gradlex.jvm-dependency-conflict-resolution") version "..."
}
```

The plugin also exposes a DSL to fix incorrect dependency metadata, align related modules to the same version, and route all logging through a single framework.
I've written about a few of these in passing, for example when [configuring annotation processors](/blog/2025/05/16/immutables-with-gradle) to keep them off the runtime classpath.

Fewer entries in your verification metadata means a less daunting file at review time, fewer signing keys to chase down, and a smaller attack surface for the supply chain compromises that dependency verification exists to defend against in the first place.

## Conclusion

Dependency verification is one of those features where the initial setup is the easy part.
The real cost is in keeping the verification metadata maintainable as your dependency graph evolves.
The best practices above are aimed at exactly that: minimizing the churn on the metadata file, keeping it reviewable for humans, and making sure the graph it describes is the graph your build actually resolves to.

If you're not yet using dependency verification on your projects, the [original post](/blog/2025/02/10/gradle-dependency-verification) is a good starting point.
If you are, take a look at your `verification-metadata.xml` and ask yourself: would I be able to review a Renovate PR against this file six months from now without losing an afternoon?
If the answer is no, the practices above are a good place to start.

---

_If you need help setting up or maintaining dependency verification on your Gradle build, I offer [consulting services](/services/gradle). Feel free to reach out._
