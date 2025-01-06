---
title: "Wrapping Elephants in Snowflakes"
description: "How to build a Gradle project using Nix - 2025 edition."
pubDate: "2025-01-02"
image: "https://images.unsplash.com/photo-1714846201575-4f06e069dc6f?q=80&w=640&auto=format&fit=crop"
---

# Wrapping Elephants in Snowflakes

## Introduction
[Gradle build tool](https://gradle.org) is known for its flexibility and powerful dependency management, and has become the cornerstone of many JVM-based projects.
Meanwhile, the [Nix package manager](https://nixos.org) is celebrated for its reproducibility and sandboxed builds, ensuring complete isolation from the host system.

While both tools excel individually, combining them presents a unique challenge.
Gradle's dynamic dependency resolution conflicts with Nix's strict sandboxing, creating hurdles for developers attempting to wrap Gradle projects in Nix.

## Problem Statement
Gradle dynamically retrieves dependencies from remote repositories like [Maven Central](https://search.maven.org) during build time.
This approach conflicts with Nix's sandboxing philosophy, which prohibits network access during builds unless explicitly allowed.

When wrapping a Gradle project in Nix, this incompatibility becomes evident: Gradle builds fail to retrieve dependencies due to Nix's isolation.
Nix demands explicit declaration of all build inputs, whereas Gradle relies on dynamic resolution—a clear mismatch that has long made this integration challenging.

## Prior Art  
Developers have historically addressed this issue with a workaround described by Brian McGee in his [blog post](https://bmcgee.ie/posts/2023/02/nix-what-are-fixed-output-derivations-and-why-use-them/).
The process involves splitting the build into two stages:

1. **Dependency Resolution (Outside the Sandbox)**:
   A pre-build step runs outside Nix's sandbox to download all Gradle dependencies.
   This ensures that the dependencies are retrieved without violating Nix's sandboxing rules.

2. **Main Build (Inside the Sandbox)**:
    Once dependencies are downloaded, they are packaged into a fixed-output derivation.
    This derivation serves as a reproducible input to the actual build step, which runs inside the Nix sandbox.

While effective, this approach has a significant drawback: the dependencies are packaged into a single fixed-output derivation.
This results in coarse-grained Nix cache eviction—even if a single dependency changes, the entire derivation must be rebuilt.
This inefficiency can slow development and increase resource consumption, particularly for large projects with many dependencies.

## The 2025 Solution
A new approach introduced in at the end of 2024 in [nixpkgs](https://github.com/NixOS/nixpkgs) simplifies the process by using updated Gradle build backed by [mitm-cache](https://github.com/chayleaf/mitm-cache).

This solution introduces a dependency lock file in JSON format, explicitly maintained by the developer. The process works as follows:

1. **Generate a Dependency Lock File**:
   Developers run a Gradle task outside the sandbox to generate a dependency lock file. This file explicitly lists all dependencies and their sources in a reproducible JSON format.

2. **Populate the MITM Cache**:
   The dependency lock file is read by the mitm-cache, which downloads the listed dependencies and stores them locally.

3. **Sandboxed Build with Cached Dependencies**:
   During the build process inside the Nix sandbox, the mitm-cache serves the required dependencies directly from its local store, ensuring the build adheres to Nix's reproducibility and isolation principles.

This approach not only eliminates the need for fixed-output derivations but also introduces finer-grained caching.
With the dependency lock file, only the dependencies that change are downloaded again, significantly improving build efficiency and reducing unnecessary rebuilds.
Of course this comes at the cost of having to manually update the dependency lock file when dependencies in the Gradle build change.

## Example
To start using this new infrastructure, refer to the detailed instructions in the [Nixpkgs Manual](https://nixos.org/manual/nixpkgs/stable/#gradle).
The manual provides guidance on how to configure your Gradle projects for seamless integration with Nix, including generating the dependency lock file and leveraging the mitm-cache.

As en example, let's create a Nix derivation that [build groovy-language-server](https://github.com/GroovyLanguageServer/groovy-language-server):

```nix
{
  stdenv,
  fetchFromGitHub,
  gradle_7,
  jre,
  makeWrapper,
}: let
  self = stdenv.mkDerivation (_finalAttrs: {
    pname = "groovy-language-server";
    version = "unstable-2024-02-01";

    src = fetchFromGitHub {
      owner = "GroovyLanguageServer";
      repo = "groovy-language-server";
      rev = "4866a3f2c180f628405b1e4efbde0949a1418c10";
      sha256 = "sha256-LXCdF/cUYWy7mD3howFXexG0+fGfwFyKViuv9xZfgXc=";
    };

    nativeBuildInputs = [gradle_7 makeWrapper];

    mitmCache = gradle_7.fetchDeps {
      pkg = self;
      # update or regenerate this by running
      #  $(nix build .#groovy-language-server.mitmCache.updateScript --print-out-paths)
      data = ./deps.json;
    };

    # defaults to "assemble"
    gradleBuildTask = "shadowJar";

    # will run the gradleCheckTask (defaults to "test")
    doCheck = true;

    installPhase = ''
      mkdir -p $out/{bin,share/groovy-language-server}
      cp build/libs/source-all.jar $out/share/groovy-language-server/groovy-language-server-all.jar

      makeWrapper ${jre}/bin/java $out/bin/groovy-language-server \
        --add-flags "-jar $out/share/groovy-language-server/groovy-language-server-all.jar"
    '';
  });
in
  self
```

What's important here is the let-in binding that assigns the derivation to a variable called `self`.
Without this it's not possible to generate the dependencies lock file for package that are not local to nixpkgs.
Refer to the manual section linked above for more details about this.

In order to generate or update the `deps.json` dependency lock file, run `$(nix build .#groovy-language-server.mitmCache.updateScript --print-out-paths)`.
This command first generates a shell script that, when executed, writes the lock file adjecent to the package definition.
The `--print-out-paths` flag tells nix to output the store location of the file.
Wrapping the whole line into `$(...)` immediately executes the file.
If you have security concerns, you can omit the `$(...)` wrapping to build the script without executing it automatically.
This allows you to inspect the script’s contents to verify its behavior before manually executing it.

## Conclusion
The new Gradle build support in Nixpkgs standardizes how developers approach wrapping Gradle projects in Nix.
By introducing the dependency lock file and leveraging the mitm-cache, this solution bridges the gap between Gradle's dynamic dependency resolution and Nix's strict reproducibility.

While developers must now manage a dependency lock file, the benefits of a streamlined, sandbox-compliant build process outweigh the additional effort.
The ability to achieve finer-grained caching ensures that only updated dependencies are downloaded, streamlining the build process and improving efficiency.

Need help with Gradle, Nix, or both? As a seasoned developer with experience in both ecosystems, I specialize in helping teams streamline their build pipelines, improve reproducibility, and overcome challenges like those described in this post.
Whether it’s implementing the latest tools or troubleshooting complex builds, I’m here to help.
Check out my [services page](/services) to learn more, and let’s tackle your build challenges together!

