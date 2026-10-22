---
title: "A Poor Man's Solution to Gradle's Rich Console Issue on NixOS"
description: "A follow-up to my post on Gradle's rich console on Nix: a small patchelf script in my nix configuration that repairs the native library cache whenever the Gradle wrapper breaks rich console."
topics: ["Gradle", "NixOS", "Nix"]
updated: 2026-10-22
---

A few months ago I wrote about [why Gradle's rich console fails on Nix](/blog/2026/05/26/gradle-rich-console-nix/).
In short: when a Gradle distribution is downloaded via the Gradle wrapper, it will extract native libraries into Gradle user home, which cause the rich console to break.
The workaround I suggested back then, pinning `org.gradle.console=rich` in `~/.gradle/gradle.properties`, also stopped feeling right somewhere along the way.
It forces rich console everywhere, including in contexts where auto-detection would correctly pick plain: pipes, CI, redirected output, Gradle being run by an agent.
The whole reason `--console=auto` exists is to make this decision automatically depending on where and how Gradle is run.
Baking the answer into a properties file throws that away.

So instead I went with a poor man's solution: a small script that patches the cached libraries after the fact and gets the console as close to working as it can get without an upstream fix.

## The script

The cached native library breaks for exactly one reason: the `libnative-platform-curses.so` sitting in `~/.gradle/native` has no `RUNPATH`, so the nixpkgs JDK's dynamic linker can't resolve its `NEEDED` entries (`libncursesw.so.6`, `libtinfo.so.6`).
So the fix is to give the cached `.so` a `RUNPATH`, in place, after the fact, and it loads again.
`patchelf` can do that in milliseconds, and the nix store has stable paths for both ncurses and libstdc++ that every nix-built binary on the machine already references.

That script lives in my [nix-configuration repo](https://github.com/britter/nix-configuration) as a package called [`fix-gradle-console`](https://github.com/britter/nix-configuration/blob/42fe0149b37e78d82fc764968ea142dc0b1305e3/packages/fix-gradle-console/default.nix) (written with generous help from [Claude Code](https://claude.com/claude-code), because ten-line shell scripts are exactly what it's good at):

```nix
{
  lib,
  writeShellApplication,
  patchelf,
  ncurses,
  stdenv,
}:
writeShellApplication {
  name = "fix-gradle-console";

  runtimeInputs = [ patchelf ];

  text = ''
    # Fix Gradle's broken rich console auto-detection caused by bare native
    # libraries in the ~/.gradle/native cache (see
    # britter.dev/blog/2026/05/26/gradle-rich-console-nix/).
    #
    # Wrapper-downloaded Gradle distributions extract .so files without a
    # RUNPATH; a nixpkgs-built JDK's dlopen then can't resolve their
    # ncurses dependencies. Patch the RUNPATH in place so the cached
    # libraries load. Works for any Gradle version sharing the cache.
    #
    # Set the RUNPATH unconditionally: --set-rpath is idempotent, and
    # re-patching also refreshes stale store paths after a nixpkgs
    # update or garbage collection.

    nativeDir="''${GRADLE_USER_HOME:-$HOME/.gradle}/native"
    rpath="${
      lib.makeLibraryPath [
        ncurses
        stdenv.cc.cc
      ]
    }"

    if [ ! -d "$nativeDir" ]; then
      echo "No native cache at $nativeDir, nothing to fix." >&2
      exit 0
    fi

    patched=0
    while IFS= read -r -d "" so; do
      current="$(patchelf --print-rpath "$so")"
      if [ "$current" != "$rpath" ]; then
        echo "Patching $so"
        patchelf --set-rpath "$rpath" "$so"
        patched=$((patched + 1))
      fi
    done < <(find "$nativeDir" -name 'libnative-platform-curses.so' -type f -print0)

    echo "Patched $patched libraries. Rich console should work again."
  '';
}
```

Note that the script doesn't skip libraries that already have a `RUNPATH` — it re-patches whenever the existing `RUNPATH` differs from the expected one. `patchelf --set-rpath` replaces rather than appends, so running it twice is harmless. This matters more than it sounds: the `RUNPATH` baked into the cache points at a specific nix store path, and when a nixpkgs update changes that path (and garbage collection removes the old one), a script that only patched empty `RUNPATH`s would happily leave the stale, now-dangling one in place. With the comparison in place, the next run of the script refreshes those paths automatically.
Because it operates on whatever is currently in the cache, it doesn't care which Gradle version put the files there: a new wrapper version that ships a new native-platform version simply creates a new cache directory, and the next run of the script patches that one too.

The nix store paths in `$rpath` are the interesting part.
They're not hardcoded hashes; they're interpolated from the packages the script is built against.
When a nixpkgs update changes the ncurses store path, the rebuilt script points at the new one automatically.
This is the same trick `autoPatchelf` uses at build time, just applied to files that Gradle dropped in my home directory after the fact.

The module that sets up my [Java environment](https://github.com/britter/nix-configuration/blob/42fe0149b37e78d82fc764968ea142dc0b1305e3/modules/home/development/java.nix) installs it alongside everything else:

```nix
home.packages = [
  pkgs.fix-gradle-console
];
```

Running it looks like this:

```
$ fix-gradle-console
Patching /home/bene/.gradle/native/660c5614.../linux-amd64-ncurses6/libnative-platform-curses.so
Patched 1 libraries. Rich console should work again.
```

and the next `./gradlew` run auto-detects rich console again.
One command per wrapper upgrade, which for me is a handful of times a year across all my projects.

## Honest assessment

This is not nice.
It treats the symptom, not the cause: the cache still happily mixes patched and unpatched binaries, and I've just made the unpatched ones loadable.
And it requires me to notice the breakage and react.
If a project I rarely touch bumps its wrapper, I get plain console output in that project until the next time I run the script.

The alternative that actually behaves well, the upstream fixes from the last post, is still the right long-term answer, and the content-hashed cache key in native-platform remains a small, well-scoped change.
But a working shell script that makes the problem disappear beats an annoying symptom I keep meaning to fix upstream.
At some point the pragmatic thing to do was to write it down, wire it into home-manager, and get on with my life.

If you're on NixOS (or any host with a nixpkgs-built JDK) and the rich console keeps dying on you after wrapper upgrades, the script is in [my nix-configuration](https://github.com/britter/nix-configuration/blob/42fe0149b37e78d82fc764968ea142dc0b1305e3/packages/fix-gradle-console): steal it, adjust the `$rpath` to your libc situation, and let Gradle's auto-detection keep doing its job.

## An alternative from Mastodon

After I posted this, [@VerdettoQR replied on Mastodon](https://mastodon.social/@VerdettoQR/117473960579325788) with a suggestion I hadn't considered: skip the patching and set `LD_LIBRARY_PATH` in a direnv-managed shell instead. The dynamic linker then finds the ncurses libraries on its own, and the missing `RUNPATH` in the cached `.so` stops mattering.

I haven't tried this, but I think it should work. The cached library fails to load for exactly one reason: the linker can't resolve its `NEEDED` entries. Hand it a search path that contains them, and there is nothing left to patch. Instead of a home-manager package that repairs the global cache, the fix lives in the project's dev shell:

```nix
{
  devShells.default = pkgs.mkShell {
    packages = [
      pkgs.ncurses
    ];

    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.ncurses
      pkgs.stdenv.cc.cc.lib
    ];
  };
}
```

The shell doesn't need to bring its own JDK: whatever JDK runs `./gradlew` is the one that dlopens the curses library, and it picks up `LD_LIBRARY_PATH` from the environment like any other process. Add the usual `use nix` to the project's `.envrc`, and every Gradle run from that shell resolves the libraries without touching the cache. It also keeps the override scoped to the project, where my script rewrites binaries in `~/.gradle/native` that every Gradle version on the machine shares.

It only works for projects you own, though. Adding a dev shell to your own repository is a one-time change, but for a project you just want to contribute a fix to, there is nowhere to put it. You'd have to carry a local, uncommitted direnv override or a wrapper script around, per project, which is the kind of ceremony I wanted to get rid of in the first place. That's why I'll stick with the patchelf script: it fixes the cache once and doesn't care which repository I'm in.
