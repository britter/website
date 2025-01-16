---
title: "Fixing Missing libudev Warnings from Gradle on NixOS"
description: "Learn how to resolve Gradle's missing libudev warnings on NixOS, ensuring smooth builds and complete telemetry data."
pubDate: "2025-01-16"
image: "nixos-gradle-libudev.png"
---

In a [previous blog post](/blog/2025/01/02/gradle-nix), we explored how to build [Gradle](https://gradle.org) projects using [Nix](https://nixos.org), diving into the specifics of wrapping Gradle into the Nix ecosystem.
Today, we’re shifting focus to a different challenge—a problem that arises when running Gradle directly on a NixOS system.

NixOS, with its unique approach to package management and system configuration, can sometimes expose quirks in software that relies on assumptions about traditional Linux distributions.
One such case involves Gradle’s need for `libudev` to collect system-level telemetry data for build scans. This feature allows developers to gain insights into their builds, but on NixOS, it hasn’t always worked seamlessly.

## A closer look at the problem

Starting recently, Gradle began issuing the following warning when run on a NixOS system:

```
Did not find udev library in operating system. Some features may not work.
Disk Store information requires libudev, which is not present.
```

This warning appears because Gradle started using the [oshi library](https://github.com/oshi/oshi), a Java library designed to collect system-level telemetry.
Oshi uses [JNA](https://github.com/java-native-access/jna) (Java Native Access) to load `libudev` which required it to be present in well-known locations, such as `/usr/lib/`.

However, due to the fact that NixOS does not follow the [Filesystem Hierarchy Standard](https://en.wikipedia.org/wiki/Filesystem_Hierarchy_Standard), Oshi cannot find `libudev` on NixOS machines.
As a result, this warning is logged during Gradle builds.
While Gradle builds continue to function without issues, build scans will lack certain system-level data.

## Initial fix

An initial fix for this issue was introduced in the [nixpkgs repository](https://github.com/NixOS/nixpkgs/pull/358670).
This fix involves setting the `jna.library.path` system property for the Gradle package installed via Nix.
The `jna.library.path` property controls the locations that the JNA infrastructure searches for native libraries.

By configuring this property to include the appropriate paths on NixOS, the problem with `libudev` is resolved, enabling Gradle to find the library and collect the necessary telemetry data for build scans.

## Extending the fix for Gradle wrapper users

While the initial fix works when invoking the Gradle binary installed on the system, most users rely on the [Gradle wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html).
The Gradle wrapper fixes the Gradle version on a per-project basis and downloads Gradle distributions into the Gradle user home folder.
Unfortunately, these distributions do not include the `jna.library.path` fix, and as a result, the problem persists when using the wrapper.

To address this, the fix needs to be ported to the `gradle.properties` file in the Gradle user home folder (typically `~/.gradle/gradle.properties`), ensuring the `jna.library.path` configuration is available to Gradle distributions managed by the wrapper.

Using the [Gradle home manager module](https://nix-community.github.io/home-manager/options.xhtml#opt-programs.gradle.enable), this process is straightforward:

```nix
programs.gradle = {
  enable = true;
  settings = {
    "systemProp.jna.library.path" = lib.makeLibraryPath [pkgs.udev];
  };
};
```

This snippet configures the `jna.library.path` property to include the required library paths.
Adding this configuration to the Gradle home manager module itself, so it is automatically applied, is already under discussion in the [home manager repository](https://github.com/nix-community/home-manager/issues/6326).

## Conclusion

Running applications on NixOS can occasionally produce glitches due to its non-standard approach to package management and system configuration.
However, the NixOS community consistently works to identify and resolve such issues, ensuring a smooth experience for its users.
The fixes discussed in this post highlight the collaborative efforts to address challenges like Gradle's `libudev` warning.

If you’re facing challenges with Gradle or NixOS, I offer [consulting services](/services) to help you navigate and solve these issues effectively.
Feel free to reach out—I’d be happy to assist!
