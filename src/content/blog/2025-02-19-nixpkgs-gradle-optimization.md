---
title: "Optimizing Gradle Build Support in nixpkgs"
description: "This is another blog post that covers the intersection between Gradle and NixOS. This time we look at an optimization I made to the Gradle build support in nixpkgs."
pubDate: "2025-02-19"
image: "gradle-nixos-race.png"
---

I have [previously](/blog/2025/01/02/gradle-nix/) blogged about the Gradle build support in [nixpkgs](https://github.com/NixOS/nixpkgs), where we looked at it from the consumer side.
This time, we are digging into how it works under the hood, discussing its limitations, and presenting an optimization to improve its efficiency and maintainability.

## The Challenge

One of the biggest hurdles with packaging projects using Gradle as their build tool as a [Nix](https://nixos.org) package, is dealing with dependency resolution.
Gradle’s dynamic dependency resolution and caching mechanisms conflict with Nix’s approach to immutable and reproducible builds.
The traditional approach within nixpkgs has been to fetch dependencies ahead of time and provide them in a structured manner.
To make life easier, nixpkgs provides [dedicated Gradle build support](https://github.com/NixOS/nixpkgs/blob/35f0dd3d2f0e325675e25fb1e6a0b90a168ccfd2/doc/languages-frameworks/gradle.section.md).

## How nixpkgs Gradle Build Support works

To ensure all dependencies required for a Gradle build are captured, nixpkgs employs a [Man in the Middle (MITM)](https://github.com/chayleaf/mitm-cache) cache.
This cache functions as a proxy, intercepting dependency requests and storing metadata about resolved artifacts in a structured JSON file.
When generating the dependency lock file for Nix, the Gradle build is configured to use this proxy, ensuring that every dependency fetch operation passes through it.

In order to force resolution of all dependencies, a custom Gradle task is injected into the build process using an init script.
This task explicitly resolves all necessary dependencies, ensuring they are properly recorded in the dependency lock file.
Once this metadata is captured, the package can be built as a Nix package by running `nix-build -A name-of-the-package`.
This triggers an offline Gradle build, with dependencies provided from Nix’s package store as a pre-built step, eliminating the need for Gradle to fetch them dynamically.

## The Optimization

Unfortunately, there's a problem with the [init script](https://github.com/NixOS/nixpkgs/blob/c4d170bd4fb209b6b7aa1d330da66ef9a4d3dd10/pkgs/development/tools/build-managers/gradle/init-deps.gradle) that is injected.
Let's take a look at it:

```groovy
gradle.projectsLoaded {
  rootProject.allprojects {
    task nixDownloadDeps {
      doLast {
        configurations.findAll{it.canBeResolved}.each{it.resolve()}
        buildscript.configurations.findAll{it.canBeResolved}.each{it.resolve()}
      }
    }
  }
}
```

As you can see, the script has two main issues:

1. It registers a task on each project that resolves all configurations of that project without properly declaring task inputs.
   This is not compatible with the configuration cache, and results in a build failure when writing the dependency lock file if a project enables the configuration cache via `gradle.properties`.
2. It registers tasks from a `rootProject.allprojects` block, which will not work anymore with [isolated projects](https://docs.gradle.org/current/userguide/isolated_projects.html) enabled.
   Isolated Projects is a "pre-alpha" feature that imposes restrictions on how one project can access the other.
   Creating tasks from one project—even if it's the root project—in another project, is prohibited when isolated projects is turned on.

To fix this, my proposal is to get rid of the `init-deps.gradle` script altogether and instead rely on the [**Dependency Verification**](https://docs.gradle.org/current/userguide/dependency_verification.html) feature to resolve all dependencies.
Forcing Gradle to resolve all dependencies is as easy as running `./gradlew --write-verification-metadata sha256`.
This is also the [proposed approach](https://discuss.gradle.org/t/force-resolving-and-downloading-all-dependencies/35942/5) by some of the Gradle engineers for the use case of resolving all dependencies.
It ensures better compatibility with modern Gradle features while keeping dependency resolution explicit and reproducible.
So instead of injecting an init script with a custom task that resolves all dependencies, the Gradle build support in nixpkgs, could simply instruct Gradle to write verification metadata thereby forcing resolution of all dependencies, which would then be captured in the dependency lock file.

## Looking Ahead

I have submitted this proposal to the nixpkgs maintainers for discussion in [this issue](https://github.com/NixOS/nixpkgs/issues/381969).
After receiving positive feedback, I have prepared a [draft pull request](https://github.com/NixOS/nixpkgs/pull/383115) implementing the changes.
The PR looks promising, although there are still some details to sort out. However, I expect it to be merged soon once the final issues are resolved.
If you’re interested in contributing or testing these changes, stay tuned for updates and discussions in the nixpkgs repository!

If you need help with Gradle or NixOS, I offer [consulting services](/services) and would be happy to assist.
