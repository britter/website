---
title: "A Poor Man's Solution to Gradle's Rich Console Issue on NixOS"
description: "The upstream fixes for Gradle's broken rich console auto-detection on Nix haven't materialized, so here's a patchelf one-liner in my dotfiles that fixes the native cache in place after every wrapper upgrade."
topics: ["Gradle", "NixOS", "Nix"]
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

That script lives in my [nix-configuration repo](https://github.com/britter/nix-configuration) as a package called [`fix-gradle-console`](https://github.com/britter/nix-configuration/blob/271c18a63e876a7e9bce2d9ed161c692247d2564/packages/fix-gradle-console/default.nix) (written with generous help from [Claude Code](https://claude.com/claude-code), because ten-line shell scripts are exactly what it's good at):

```nix
{
  writeShellApplication,
  patchelf,
  ncurses,
  stdenv,
}:
writeShellApplication {
  name = "fix-gradle-console";

  runtimeInputs = [ patchelf ];

  text = ''
    nativeDir="''${GRADLE_USER_HOME:-$HOME/.gradle}/native"
    rpath="${ncurses}/lib:${stdenv.cc.cc.lib}/lib"

    if [ ! -d "$nativeDir" ]; then
      echo "No native cache at $nativeDir, nothing to fix." >&2
      exit 0
    fi

    patched=0
    while IFS= read -r -d "" so; do
      if [ -z "$(patchelf --print-rpath "$so")" ]; then
        echo "Patching $so"
        patchelf --set-rpath "$rpath" "$so"
        patched=$((patched + 1))
      fi
    done < <(find "$nativeDir" -name 'libnative-platform-curses.so' -type f -print0)

    echo "Patched $patched libraries. Rich console should work again."
  '';
}
```

Libraries that already have a `RUNPATH` are left alone, so running it twice is harmless.
Because it operates on whatever is currently in the cache, it doesn't care which Gradle version put the files there: a new wrapper version that ships a new native-platform version simply creates a new cache directory, and the next run of the script patches that one too.

The nix store paths in `$rpath` are the interesting part.
They're not hardcoded hashes; they're interpolated from the packages the script is built against.
When a nixpkgs update changes the ncurses store path, the rebuilt script points at the new one automatically.
This is the same trick `autoPatchelf` uses at build time, just applied to files that Gradle dropped in my home directory after the fact.

The module that sets up my [Java environment](https://github.com/britter/nix-configuration/blob/271c18a63e876a7e9bce2d9ed161c692247d2564/modules/home/development/java.nix) installs it alongside everything else:

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

If you're on NixOS (or any host with a nixpkgs-built JDK) and the rich console keeps dying on you after wrapper upgrades, the script is in [my nix-configuration](https://github.com/britter/nix-configuration/blob/271c18a63e876a7e9bce2d9ed161c692247d2564/packages/fix-gradle-console): steal it, adjust the `$rpath` to your libc situation, and let Gradle's auto-detection keep doing its job.
