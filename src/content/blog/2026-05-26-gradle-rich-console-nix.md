---
title: "Why Gradle's Rich Console Fails on Nix"
description: "A walk through the two upstream design choices that combine to silently disable Gradle's rich console auto-detection on Nix: a native-platform cache that doesn't notice patched libraries, and a JDK that can't see /lib64. With the upstream fixes that would address both."
topics: ["Gradle", "NixOS", "Nix"]
---

In January 2025 I [reported a bug](https://github.com/gradle/gradle/issues/32006) against [Gradle](https://gradle.org): starting with version 8.12, running Gradle on [NixOS](https://nixos.org) produced plain console output by default, where 8.11.1 had shown the rich, colorful, progress-bar console.
The `--console=rich` command line flag still worked, so rendering wasn't broken, just the auto-detection of the console mode.
Other people on Arch, Fedora, and macOS couldn't reproduce it.
At the time, I commented on the issue with my hypothesis: a NixOS-specific problem related to patching native libraries.

It turns out that hypothesis was wrong, or at best half right.
Over a year later, after the non-functioning rich console kept annoying me from time to time, I sat down and traced it properly.
The actual cause is two unrelated upstream design choices that compose into a silent failure, and the "regression from 8.11.1 to 8.12" was a coincidence.
This post walks through the investigation and lays out what would actually fix it.

## How Gradle initializes rich console logging

Gradle has several console modes selectable via the `--console` flag.
`rich` is the interactive mode with colors and a dynamic progress bar that redraws as work happens.
`plain` is straight log lines without formatting, the kind of output you'd want in CI or when piping somewhere.
The default `auto` picks one based on whether stdout looks like a terminal.
There are also `verbose` and `colored` variants, but rich and plain are the two we care about here.

Gradle's rich console relies on a chain of services that have to all come together.
Going from the visible symptom inward:

`--console=auto` (the default) eventually calls [`NativePlatformConsoleDetector.getConsole()`](https://github.com/gradle/gradle/blob/e6af432bb3b543ad1b8c18d8a7c3633a370669a1/platforms/core-runtime/native/src/main/java/org/gradle/internal/nativeintegration/console/NativePlatformConsoleDetector.java#L37), which checks the `TERM` environment variable and then asks [native-platform](https://github.com/gradle/native-platform)[^1] for a [`Terminals`](https://github.com/gradle/native-platform/blob/cfc98a3a090ec67a33cac926076fa6cfc88cdd0f/native-platform/src/main/java/net/rubygrapefruit/platform/terminal/Terminals.java) service.
If anything in that chain fails, Gradle falls back to [`FallbackConsoleDetector`](https://github.com/gradle/gradle/blob/e6af432bb3b543ad1b8c18d8a7c3633a370669a1/platforms/core-runtime/native/src/main/java/org/gradle/internal/nativeintegration/console/FallbackConsoleDetector.java#L21), whose `getConsole()` always returns `null`, and `--console=auto` resolves to plain.

[^1]: native-platform is Gradle's [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface) library for low-level OS integration. Among other things, it handles terminal detection (the `Terminals` service we're tracing here) and file system event watching.

Native-platform's `Terminals` service in turn requires loading `libnative-platform-curses.so`, a JNI library bundled inside the Gradle distribution.
Native-platform tries two variants, an `ncurses5` one and an `ncurses6` one.
If either loads, you get rich console. If both fail, you don't.

The most direct way to see which branch is being taken is to run Gradle with `-d` (debug logging) and grep for the relevant messages.
The pipe to `grep` makes Gradle's stdout a non-TTY, which would normally suppress rich console anyway, but we're not testing rendering here, we're inspecting whether native-platform's initialization succeeded.
Those log lines are emitted unconditionally based on library loading, not based on stdout state:

```
$ gradle -d help 2>&1 | grep -iE 'native-?platform|console|terminal'
[INFO] Initialized native services in: /home/benedikt/.gradle/native
[INFO] Initialized jansi services in: /home/benedikt/.gradle/native
[DEBUG] Native-platform terminal integration is not available. Continuing with fallback.
[DEBUG] Connected to daemon DaemonInfo{...,nativeServicesMode=ENABLED,...}
[DEBUG] Build operation 'Resolve kotlin-native-utils-2.3.0.jar (...)' started
...
```

The grep matches a lot of unrelated noise further down (daemon-protocol traffic, build-operation logs that happen to mention "native"), but the three lines at the top are the ones that matter:

1. Native-platform's main library loaded successfully.
2. [Jansi](https://github.com/fusesource/jansi) (used by Gradle for ANSI rendering, separate from native-platform) loaded successfully.
3. The `Terminals` service specifically did not load.

The third line is the smoking gun.
Native-platform isn't broken as a whole, just one of its services.
That also explains why `--console=rich` works: the rendering path goes through jansi, which is loaded just fine.
Only auto-detection, which requires the `Terminals` service to query `isatty()`, fails.

## Finding the Terminals failure

`Terminals` on Linux comes from loading a second JNI library, `libnative-platform-curses.so`.
Native-platform's `.so` files are packaged inside JARs that ship with the Gradle distribution, alongside all the regular Java code.
On first use, the relevant ones are extracted to disk under `$GRADLE_USER_HOME/native/<NativeVersion.VERSION>/<platform>/<lib>` so the JVM can load them via `System.load()` without paying the unzip cost on every invocation.
`NativeVersion.VERSION` is a string constant baked into native-platform at build time.

Pulling that constant out of the bundled `native-platform-*.jar`:

```
$ javap -p -v -classpath /nix/store/.../gradle-9.4.1/libexec/gradle/lib/native-platform-0.22-milestone-29.jar \
    net.rubygrapefruit.platform.internal.jni.NativeVersion \
    | grep 'ConstantValue:'
ConstantValue: String 660c5614fbf4a5f2a75b1949f50a0caf5cd603558e7d8a26e50b933a0cfb79d1
```

And indeed, there is a matching directory on disk:

```
$ ls ~/.gradle/native/660c5614fbf4a5f2a75b1949f50a0caf5cd603558e7d8a26e50b933a0cfb79d1/
linux-amd64/  linux-amd64-ncurses5/  linux-amd64-ncurses6/
```

So the library files are extracted and present.
The question is why loading them fails.

Running `ldd` on the cached files turned up the first hint:

```
$ ldd ~/.gradle/native/660c5614.../linux-amd64-ncurses6/libnative-platform-curses.so
        libncursesw.so.6 => /lib64/libncursesw.so.6 (0x...)
        libtinfo.so.6 => /lib64/libtinfo.so.6 (0x...)
        libstdc++.so.6 => /lib64/libstdc++.so.6 (0x...)
        libm.so.6 => /lib64/libm.so.6 (0x...)
        libgcc_s.so.1 => /lib64/libgcc_s.so.1 (0x...)
        libc.so.6 => /lib64/libc.so.6 (0x...)
```

All dependencies resolve cleanly via `/lib64`.
`ldd` thinks this library should load fine.
But `System.load()` from a JVM doesn't behave identically to `ldd`, as we'll see.

The cached `.so` is also suspicious in another way.
It has no `RUNPATH` set:

```
$ readelf -d ~/.gradle/native/660c5614.../linux-amd64-ncurses6/libnative-platform-curses.so \
    | grep -E 'RUNPATH|RPATH|NEEDED'
 0x0000000000000001 (NEEDED)  Shared library: [libncursesw.so.6]
 0x0000000000000001 (NEEDED)  Shared library: [libtinfo.so.6]
 0x0000000000000001 (NEEDED)  Shared library: [libstdc++.so.6]
 ...
```

But the same library, freshly extracted from the JAR shipped in the nixpkgs-built Gradle, _does_ have one:

```
$ JAR=/nix/store/.../gradle-9.4.1/libexec/gradle/lib/native-platform-linux-amd64-ncurses6-0.22-milestone-29.jar
$ unzip -p $JAR net/rubygrapefruit/platform/linux-amd64-ncurses6/libnative-platform-curses.so > lib.so
$ readelf -d lib.so | grep -E 'RUNPATH|NEEDED'
 0x000000000000001d (RUNPATH)  Library runpath: [/nix/store/wl2nw5l4.../ncurses-6.6/lib:...]
 0x0000000000000001 (NEEDED)   Shared library: [libncursesw.so.6]
 ...
```

The `RUNPATH` here points into the nix store[^2].
So the cached file is _not_ the same file that's in my current Gradle install's JAR.
Same path on disk, same `NativeVersion.VERSION`, but different bytes.

[^2]: nixpkgs ships every package under `/nix/store/<hash>-<name>-<version>/`, a content-addressed directory tree isolated from the host file system. Binaries built by nixpkgs reference their dependencies by absolute store paths rather than FHS locations like `/lib64`, which is how nixpkgs achieves reproducibility and isolation across machines.

## Root cause 1: a shared cache with no content awareness

The mtime on the cached file gives this away:
the cached `.so` is from February 2026, but the nixpkgs Gradle install was rebuilt in May 2026.
Looking at native-platform's [`NativeLibraryLocator.find()`](https://github.com/gradle/native-platform/blob/cfc98a3a090ec67a33cac926076fa6cfc88cdd0f/native-platform/src/main/java/net/rubygrapefruit/platform/internal/NativeLibraryLocator.java#L41) explains how this happens:

```java
File libFile = new File(extractDir,
    String.format("%s/%s/%s", version, libraryDef.platform, libraryDef.name));
File lockFile = new File(libFile.getParentFile(), libFile.getName() + ".lock");
...
FileLock lock = lockFileAccess.getChannel().lock();
if (lockFile.length() > 0 && lockFileAccess.readBoolean()) {
    // Library has been extracted
    return libFile;
}
```

The cache key is purely `NativeVersion.VERSION`.
Once _any_ Gradle distribution writes a `.so` to that path and marks the lockfile, every subsequent run that shares the same native-platform version (system or wrapper, this Gradle version or any future one bundling the same native-platform) reads the cached file straight through, without re-extracting from its own JAR.

I had two Gradle distributions on this machine that both bundled native-platform-`660c5614...`:

1. The system Gradle installed via nixpkgs, with autoPatchelf[^3]-patched `.so` files carrying nix-store `RUNPATH`.
2. An upstream Gradle distribution downloaded by `./gradlew`[^4] in some project, which ships the original bare `.so` files with no `RUNPATH`.

[^3]: [`autoPatchelf`](https://nixos.org/manual/nixpkgs/stable/#setup-hook-autopatchelfhook) is a nixpkgs build-time hook that rewrites the `RUNPATH` of ELF binaries (and their `INTERP` for executables) to point into the nix store rather than FHS paths. It's what allows nixpkgs to repackage externally-distributed binaries like Gradle.

[^4]: The [Gradle wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html) (`./gradlew`) is a per-project script that downloads a specific version of Gradle from gradle.org on first use and caches it under `~/.gradle/wrapper/dists/`. It's how a project pins its Gradle version independently of whatever's installed on the developer's machine.

Whichever one ran first wrote the cache, and that one binary then served every other Gradle sharing the same native-platform version, for as long as the cache exists.
In practice, the wrapper-downloaded one almost always runs first.
I jump between projects pinned to different Gradle versions all the time, any of which can claim the cache slot for the matching native-platform version before the system Gradle ever gets a turn.

To verify this empirically, I tested both orderings against a freshly cleared cache:

| Order                        | nixpkgs gradle | gradle wrapper |
| ---------------------------- | -------------- | -------------- |
| nixpkgs gradle, then wrapper | rich console ✓ | rich console ✓ |
| wrapper, then nixpkgs gradle | rich console ✗ | rich console ✗ |

The first row matches the cache-poisoning story: the patched `.so` the system Gradle caches has a `RUNPATH` pointing into the nix store, that path exists on my machine regardless of who's loading the library, and the wrapper-Gradle then reads the same patched lib from the cache without trouble.
The second row contains a surprise.
When the wrapper Gradle wins, the bare `.so` it caches breaks not just the system Gradle reading it later, but also the wrapper-Gradle invocation that just placed it there.
I would have expected those bare libs to work for the wrapper-Gradle on Fedora, since `/lib64` has every `NEEDED` library they reference.
We'll come back to that surprise in a moment.

That also explains the original report.
I almost certainly hit the bug because at some point I ran a project's `./gradlew` (which fetched bare libs into the cache) between switching from system Gradle 8.11.1 to 8.12, or some similar interleaving.
The version bump didn't introduce the bug, cache poisoning did, and it persisted across upgrades because nothing invalidates that cache.
Any two distributions sharing a `NativeVersion.VERSION` can produce the same outcome.

This isn't a Nix-only problem, by the way.
Any post-distribution modification of bundled native libs would break this cache: vendor patches, security re-signing, reproducible-build variants, anything that produces bit-different binaries while preserving the version constant.
It just happens that Nix's autoPatchelf is the most common cause in practice.

## Root cause 2: nixpkgs JDKs can't load bare bundled libs

I would understand the wrapper case being broken on a strict NixOS machine.
NixOS doesn't ship `/lib64/ld-linux-x86-64.so.2`, doesn't follow the [Filesystem Hierarchy Standard](https://en.wikipedia.org/wiki/Filesystem_Hierarchy_Standard) (FHS), and bare ELF binaries that hardcode FHS paths simply can't run there.
But my work laptop is Fedora 43 with Nix layered on top, and the libraries that bare `.so` files need are right where they're supposed to be:

```
$ ls -l /lib64 | grep -E 'ncurses|tinfo'
lrwxrwxrwx. 1 root root        17 Jul 24  2025 libncurses.so.6 -> libncurses.so.6.5
-rwxr-xr-x. 1 root root    187608 Jul 24  2025 libncurses.so.6.5
lrwxrwxrwx. 1 root root        18 Jul 24  2025 libncursesw.so.6 -> libncursesw.so.6.5
-rwxr-xr-x. 1 root root    262456 Jul 24  2025 libncursesw.so.6.5
lrwxrwxrwx. 1 root root        15 Jul 24  2025 libtinfo.so.6 -> libtinfo.so.6.5
-rwxr-xr-x. 1 root root    187368 Jul 24  2025 libtinfo.so.6.5
```

`ldd` agrees: running it against the bare cached `libnative-platform-curses.so` resolves every `NEEDED` entry via `/lib64`.
So why is rich console broken even for the wrapper-downloaded Gradle on Fedora?

While thinking about it, it occurred to me that my JDK is also from nixpkgs.
It's installed by [my home-manager configuration](https://github.com/britter/nix-configuration/blob/185415c3bc81b24c9061424d9a91e59024fcf4eb/home/java/default.nix), so `JAVA_HOME` points into the nix store, and that's the JVM `./gradlew` runs against in every one of my projects.
`ldd` invokes the system dynamic linker, but the JVM uses its own `dlopen` path, and doesn't have to behave the same way.
Maybe this nixpkgs-built JDK simply can't see `/lib64`, regardless of what `ldd` thinks.

To check, I wrote a small Java program whose only job is to load a library and report what happens:

```java
public class LoadProbe {
    public static void main(String[] args) {
        try {
            System.load(args[0]);
            System.out.println("LOAD OK: " + args[0]);
        } catch (Throwable t) {
            System.out.println("LOAD FAILED: " + t.getClass().getName() + ": " + t.getMessage());
            t.printStackTrace();
        }
    }
}
```

It takes a library path as its only argument, calls `System.load()` on it, and prints either an OK message or the full exception details on failure.
Running it against the bare cached `libnative-platform-curses.so`:

```
$ $JAVA_HOME/bin/javac LoadProbe.java
$ $JAVA_HOME/bin/java LoadProbe \
    ~/.gradle/native/660c5614.../linux-amd64-ncurses6/libnative-platform-curses.so
LOAD FAILED: java.lang.UnsatisfiedLinkError: ...libnative-platform-curses.so:
    libncursesw.so.6: cannot open shared object file: No such file or directory
```

Confirmed: `dlopen` from this JVM can't find `libncursesw.so.6`, even though it sits right there in `/lib64`.

Setting `LD_LIBRARY_PATH` to include `/lib64` makes the same load succeed:

```
$ LD_LIBRARY_PATH=/lib64 $JAVA_HOME/bin/java LoadProbe \
    ~/.gradle/native/660c5614.../linux-amd64-ncurses6/libnative-platform-curses.so
LOAD OK: .../libnative-platform-curses.so
```

So `/lib64` simply isn't on the search path the JVM's `dlopen` is using.
`LD_DEBUG=libs` confirms why:

```
$ LD_DEBUG=libs $JAVA_HOME/bin/java LoadProbe ... 2>&1 | grep "search path" | head -3
search path=/nix/store/84yacbdsnjk9qvhzxj7964rwh3qvvah8-openjdk-25.0.2+10/lib/openjdk/...
    :/nix/store/bg6ms0vw071g1fdbx2my6bbzsk62p6vd-fontconfig-2.17.1-lib/lib/...
    :/nix/store/...
    (RUNPATH from file /nix/store/.../openjdk/bin/java)
...
search path=/nix/store/fjkx1l5cnskzrqacf08z7i8z17256w0j-glibc-2.42-61/lib...
    (system search path)
```

Every search-path entry is a `/nix/store/...` path.
Even the entries the dynamic linker labels as `(system search path)` are nix-store paths, because the JDK was linked against the nix-store glibc and inherits that glibc's defaults.
`/etc/ld.so.cache`, which on Fedora maps `libncursesw.so.6` to `/lib64/libncursesw.so.6`, is effectively ignored.

This is [intentional nixpkgs behavior](https://nixos.org/manual/nixpkgs/stable/#sec-stdenv-dependencies): nix-built binaries are deliberately decoupled from FHS paths to keep them reproducible and isolated from the host system.
The side effect is that any JNI library shipping bare bundled binaries, relying on `/etc/ld.so.cache` to find its `NEEDED` libraries, can't be loaded from a nixpkgs JDK at all.
Gradle's wrapper-downloaded distributions are the prime example, because every project's `./gradlew` fetches one.

A useful sanity check: would the wrapper-downloaded Gradle just work if `JAVA_HOME` pointed to a JDK that wasn't built by nixpkgs?
I didn't want to install one alongside the nixpkgs ones, but Gradle's toolchain mechanism[^5] had already downloaded a few non-nix Adoptium builds into `~/.gradle/jdks/` on my behalf, for projects that pinned specific JDK vendors and versions.
Running `LoadProbe` against the same bare `.so`, but with one of those:

```
$ /home/benedikt/.gradle/jdks/eclipse_adoptium-21-amd64-linux.2/bin/java LoadProbe \
    ~/.gradle/native/660c5614.../linux-amd64-ncurses6/libnative-platform-curses.so
LOAD OK: ...libnative-platform-curses.so
```

Same bare lib, same machine, same file, but the FHS-built JVM loads it without issue.
And end to end: with the native cache cleared, `JAVA_HOME` pointed at that Adoptium build, and `./gradlew help` run in a project, rich console renders normally.
The bug is conditional on the launcher JVM: not a practical fix since I don't want to manage my JDK outside nixpkgs, but a clean attribution of where the failure actually lives.
It's also the answer to the surprise from cause 1: when the wrapper-Gradle puts bare libs in the cache and immediately tries to read them back, the same nixpkgs JDK can't load them either.

All told, the visible symptom of "no rich console" has two distinct root causes that you can hit together or separately:

1. Cache collision in native-platform's `NativeLibraryLocator`.
2. nixpkgs JDK's dynamic linker can't resolve bare libraries' dependencies.

[^5]: Gradle's [toolchain mechanism](https://docs.gradle.org/current/userguide/toolchains.html) lets a project declare which JDK Gradle should use to build its Java code (compilation, tests, etc.) and downloads one if none matches locally. That's separate from the JDK used to _run_ Gradle itself, which is determined by `JAVA_HOME` or `java` on `PATH`. Gradle has since added [daemon toolchains](https://docs.gradle.org/current/userguide/gradle_daemon.html#sec:daemon_jvm_criteria) for picking the JDK that runs the build daemon via `gradle/gradle-daemon-jvm.properties`, but those don't cover the launcher process where console rendering actually happens. Their auto-download is also a thinner subset of the regular toolchain machinery: it relies on explicit per-platform download URLs in the properties file rather than discovering JDKs through configured toolchain repositories. So neither mechanism would have fixed the bug for me.

## How to fix rich console on Nix

The intuitive fix on the nixpkgs side is to set `org.gradle.native.dir` on the nix-installed Gradle to a private path that won't collide with the default `~/.gradle/native`.
That works in isolation: the system Gradle would have its own cache with patched libs and would never read bare ones.

But it doesn't help the case I actually hit in practice, a project with `./gradlew`.
That wrapper downloads the upstream Gradle entirely outside nixpkgs control, runs it with the user's `JAVA_HOME`, and that JVM still can't load bare bundled libs.
The wrapper-Gradle invocation itself is broken regardless of where its cache lives.

So the fix has to be upstream.
There are two candidates, addressing each root cause:

**Content-hash in native-platform's cache key.** A ~10-line change in `NativeLibraryLocator.find()` to fold a hash of the JAR resource's bytes into the extraction path.
Different bytes, different cache slot.
Cost: one hash computation on first load, sub-millisecond for a ~30KB library.
The current key assumes that the same `NativeVersion.VERSION` implies byte-identical binaries, which is wrong for any distribution-level post-processing.
A reproducer doesn't need Nix at all: just `strip` a `.so` inside a JAR and observe that the next run reads the unmodified cached version.

**Pure-Java fallback for `ConsoleDetector`.** Gradle's current [`FallbackConsoleDetector`](https://github.com/gradle/gradle/blob/e6af432bb3b543ad1b8c18d8a7c3633a370669a1/platforms/core-runtime/native/src/main/java/org/gradle/internal/nativeintegration/console/FallbackConsoleDetector.java) is overly pessimistic: its `getConsole()` always returns `null`, even though `isInteractiveConsole()` already uses `System.console() != null` to detect a TTY in pure Java.
If `getConsole()` returned a usable, jansi-backed `ConsoleMetaData` whenever `System.console()` is available, rich console would work even when native-platform's `Terminals` service can't load for _any_ reason.
Rendering and terminal-capability detection then flow through jansi, which has its own paths that don't depend on native-platform and which handle width-aware progress bars fine.
I can confirm this empirically: setting `--console=rich` against the broken-cache state still produces a working dynamic progress bar, because once rich is selected, jansi takes over the rendering entirely.

The two fixes are complementary.
The cache-key fix is the principled correctness fix and helps every distribution.
The fallback-detector fix is a more direct user-experience fix: instead of preventing the failure, it makes the degraded path acceptable.
On my machine, the fallback-detector fix would do more good, because it would also paper over the second root cause that the cache-key fix doesn't touch.

## User workarounds in the meantime

The best bet right now is to pin the console output in `~/.gradle/gradle.properties`, bypassing auto-detection entirely:

```
org.gradle.console=rich
```

That file is read by every Gradle on startup, the nixpkgs-installed one _and_ any wrapper-downloaded distribution, so this single setting fixes the symptom for both.
The rendering path goes through jansi, which loads cleanly regardless of whether the curses lib does, so the colored output works even when the underlying `Terminals` service has failed.

If you manage your home environment with home-manager, the [`programs.gradle`](https://nix-community.github.io/home-manager/options.xhtml#opt-programs.gradle.enable) module (whose [source](https://github.com/nix-community/home-manager/blob/b8bb556ce5abe5bbc10acb7508ef273b053f647d/modules/programs/gradle.nix) I maintain) writes the same property for you:

```nix
programs.gradle = {
  enable = true;
  settings = {
    "org.gradle.console" = "rich";
  };
};
```

For teams working entirely in Nix, an alternative is to manage Gradle through a `devShell` per project and skip the wrapper.
Every `gradle` invocation in that project then comes from nixpkgs, with patched libs.
Two caveats, though.
The Gradle version isn't pinned as directly: which version you get depends on which nixpkgs commit your `flake.lock` resolves to, rather than an explicit `distributionUrl` in `gradle-wrapper.properties`.
And the protection is scoped to that one project.
Individual developers who also work on projects using the wrapper can still get their shared `~/.gradle/native` cache poisoned from those, at which point the nixpkgs Gradle reads bare libs from the cache and we're back to square one.

For users sticking with the wrapper, two more options exist, both with notable drawbacks:

- **Delete the affected cache subdirectory** after the wrapper has poisoned it, then run the nixpkgs `gradle` first to repopulate it with patched libs. The cache gets re-poisoned by the next wrapper invocation in another project, so this is more of a daily ritual than a real fix.
- **Set `LD_LIBRARY_PATH=/lib64`** in your shell on FHS hosts (Fedora-with-Nix and friends), so the nixpkgs JDK's `dlopen` can find FHS libraries. Fragile, leaks into every other program you run from that shell, and a no-op on strict NixOS where `/lib64` doesn't exist.

## Conclusion

What looked like a Gradle 8.11.1-to-8.12 regression on NixOS turned out to have nothing to do with the version bump.
The real cause is a native-platform cache that assumes the same `NativeVersion.VERSION` implies byte-identical native libraries, which doesn't hold whenever a distribution post-processes those libraries.
Nix's `autoPatchelf` is one such modifier, but vendor patches and reproducible-build variants would trip it too.
On top of that, nixpkgs-built JDKs can't `dlopen` libraries from `/lib64`.
So when bare libs end up in the cache, even the wrapper-downloaded Gradle that put them there can't load them.

For now, the most reliable workaround is setting `org.gradle.console=rich` in `~/.gradle/gradle.properties`, which sidesteps auto-detection entirely and works for both the nixpkgs-installed Gradle and any wrapper-downloaded distribution.
Longer term, two upstream changes would address the actual causes: a content-hashed cache key in native-platform, and a less pessimistic `FallbackConsoleDetector` in Gradle.
I plan to update the [original issue](https://github.com/gradle/gradle/issues/32006) with the corrected diagnosis and file upstream issues for both fixes.
With luck, what looked like an isolated Nix curiosity will turn into a small upstream correctness improvement.
