---
title: "Packaging kotlin-lsp for NixVim (Part 2)"
description: "How a version bump exposed native library dependencies in kotlin-lsp and what it takes to package them on NixOS"
topics: ["NixOS", "Kotlin", "Neovim"]
---

In my [previous post](/blog/2025/11/15/kotlin-lsp-nixvim) I described how to package [kotlin-lsp](https://github.com/Kotlin/kotlin-lsp) for use with [NixVim](https://github.com/nix-community/nixvim).
That approach worked well for a while - until it didn't.

At some point my derivation broke, and not because of anything I had changed.
JetBrains had simply removed the release archive from their download servers.
Since my derivation pointed to a specific version, it suddenly became impossible to build.
Turns out, pinning a version isn't enough - you also implicitly depend on them continuing to host that archive.

The immediate fix was obvious: update the version and hash in `fetchzip`.
But the new release came with a more interesting problem.

## kotlin-lsp is no longer "just Java"

In the original post I leaned on one of Java's biggest strengths:

> binaries are pretty portable as long as there is a JVM

That used to be true for kotlin-lsp.
The newer releases, however, ship a `native/` directory containing a file called `libfilewatcher_jni.so` - a [JNI (Java Native Interface)](https://en.wikipedia.org/wiki/Java_Native_Interface) library for file watching.
In other words: kotlin-lsp now includes native code.

If we were building kotlin-lsp from source, this wouldn't be a problem at all - [NixOS](https://nixos.org) is actually great for native code because every dependency is declared explicitly and the build environment is fully reproducible.
But as I mentioned in the previous post, JetBrains still hasn't open-sourced the full kotlin-lsp implementation, so we're stuck with pre-built binaries.

And pre-built binaries are a different story.
They were compiled on a system that follows the standard filesystem hierarchy - shared libraries in `/usr/lib` and friends.
NixOS doesn't have those global paths, so the binary can't find its dependencies at runtime:

```
error while loading shared libraries: libXYZ.so: cannot open shared object file
```

The good news is that even in this suboptimal situation, nixpkgs has exactly the right tools.

## Patching native libraries for NixOS

This was my first time writing a derivation that needed to deal with pre-built native libraries, and I had no idea where to start.
So I worked through it with [Claude Code](https://claude.ai/code) and the [NixOS wiki page on packaging binaries](https://wiki.nixos.org/wiki/Packaging/Binaries), and here is what I learned.

The solution is [patchelf](https://github.com/NixOS/patchelf), a tool from the NixOS project that can modify [ELF](https://en.wikipedia.org/wiki/Executable_and_Linkable_Format) binaries - specifically, it can rewrite the paths that a binary uses to look up shared libraries.
Instead of looking in `/usr/lib`, a patched binary will look directly into the Nix store.

The first step is to check what `libfilewatcher_jni.so` actually needs:

```
$ patchelf --print-needed libfilewatcher_jni.so
libgcc_s.so.1
librt.so.1
libpthread.so.0
libm.so.6
libdl.so.2
libc.so.6
ld-linux-x86-64.so.2
```

Most of those are part of [glibc](https://www.gnu.org/software/libc/) - the GNU C Library.
`libc.so.6` is glibc itself, and `libm`, `libpthread`, `librt`, `libdl` are companion libraries that ship alongside it.
nixpkgs makes glibc available automatically in every derivation, so `autoPatchelfHook` can resolve those without any extra configuration.

`libgcc_s.so.1` is different.
Despite the name, it's not part of glibc - it's the GCC runtime library, shipped by GCC itself.
It provides low-level runtime support like exception handling and is a separate package from the C library.
To figure out which nixpkgs package provides it, I used `nix-locate` via the [`nix-index-database`](https://github.com/nix-community/nix-index-database) project, which provides a pre-built database so you don't have to index nixpkgs yourself:

```
$ nix run "github:nix-community/nix-index-database" -- --whole-name libgcc_s.so.1
libgcc.libgcc    196,968 r /nix/store/...-gcc-15.2.0-libgcc/lib/libgcc_s.so.1
libgcc.lib             0 s /nix/store/...-gcc-15.2.0-lib/lib/libgcc_s.so.1
```

That points to the `libgcc` package. In a derivation context we reference it as `stdenv.cc.cc.lib` rather than `pkgs.libgcc` - this ensures we get the exact version of GCC that matches the rest of the build environment. `stdenv.cc` is the C compiler in the standard environment, `.cc` drills into the underlying GCC package, and `.lib` selects its library output.

Running patchelf manually on every binary would be tedious, so nixpkgs ships `autoPatchelfHook` as a convenience for derivations.
Adding it to `nativeBuildInputs` makes it run automatically during the build, scanning all ELF files and patching them against whatever is in `buildInputs`.
So all we need to do is declare the right dependencies:

```nix
nativeBuildInputs = [
  autoPatchelfHook
  makeWrapper
];

buildInputs = [
  jdk21
  stdenv.cc.cc.lib
];
```

That's enough for `autoPatchelfHook` to do its job.

## Verifying the result

After building, I run:

```
$ ldd result/share/native/libfilewatcher_jni.so
	linux-vdso.so.1 (0x00007f3c1cca6000)
	libgcc_s.so.1 => /nix/store/97rn2wpm09db8278qzjvbss9ybxhfsxf-gcc-15.2.0-libgcc/lib/libgcc_s.so.1
	librt.so.1 => /nix/store/l0l2ll1lmylczj1ihqn351af2kyp5x19-glibc-2.42-51/lib/librt.so.1
	libpthread.so.0 => /nix/store/l0l2ll1lmylczj1ihqn351af2kyp5x19-glibc-2.42-51/lib/libpthread.so.0
	libm.so.6 => /nix/store/l0l2ll1lmylczj1ihqn351af2kyp5x19-glibc-2.42-51/lib/libm.so.6
	libdl.so.2 => /nix/store/l0l2ll1lmylczj1ihqn351af2kyp5x19-glibc-2.42-51/lib/libdl.so.2
	libc.so.6 => /nix/store/l0l2ll1lmylczj1ihqn351af2kyp5x19-glibc-2.42-51/lib/libc.so.6
	/nix/store/l0l2ll1lmylczj1ihqn351af2kyp5x19-glibc-2.42-51/lib64/ld-linux-x86-64.so.2
```

Every dependency resolves to a `/nix/store/...` path and nothing is `not found`.
It doesn't prove everything works end-to-end, but it's a solid sanity check before firing up Neovim.

## The bundled JRE problem

The new release also ships a bundled `jre/` directory - presumably so kotlin-lsp can be distributed as a self-contained package.
As a consequence, the startup script no longer respects `JAVA_HOME`.
Instead, it now hardcodes a path to that bundled `./jre`.

Since we're providing `jdk21` ourselves and don't want to drag in a second JRE from inside the zip, we skip it when copying files:

```sh
cp -r lib native kotlin-lsp.sh $out/share/
```

But now the script would fail at startup because `./jre` doesn't exist in our output.
In the original derivation I handled the JDK via:

```sh
makeWrapper ... --set JAVA_HOME ${jdk21}
```

That doesn't help here anymore since the script ignores `JAVA_HOME`.
Instead I patch just the two lines that set `LOCAL_JRE_PATH`:

```sh
substituteInPlace $out/share/kotlin-lsp.sh \
  --replace-fail 'LOCAL_JRE_PATH="$DIR/jre/Contents/Home"' 'LOCAL_JRE_PATH="${jdk21}"' \
  --replace-fail 'LOCAL_JRE_PATH="$DIR/jre"' 'LOCAL_JRE_PATH="${jdk21}"'
```

This keeps the upstream logic intact and only swaps out the JRE location.

## The updated derivation

Putting it all together ([full source on GitHub](https://github.com/britter/nix-configuration/blob/03626918ab41a6a1ce8684cd4ecf51d29c681d26/packages/kotlin-lsp/default.nix)):

```nix
{
  stdenv,
  stdenvNoCC,
  fetchzip,
  makeWrapper,
  jdk21,
  autoPatchelfHook,
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "kotlin-lsp";
  version = "262.2310.0";

  src = fetchzip {
    url = "https://download-cdn.jetbrains.com/kotlin-lsp/${finalAttrs.version}/kotlin-lsp-${finalAttrs.version}-linux-x64.zip";
    sha256 = "sha256-Bf2qkFpNhQC/Mz563OapmCXeKN+dTrYyQbOcF6z6b48=";
    stripRoot = false;
  };

  nativeBuildInputs = [
    makeWrapper
    autoPatchelfHook
  ];

  buildInputs = [
    jdk21
    stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/{bin,share}
    cp -r lib native kotlin-lsp.sh $out/share

    chmod +x $out/share/kotlin-lsp.sh
    substituteInPlace $out/share/kotlin-lsp.sh \
      --replace-fail 'LOCAL_JRE_PATH="$DIR/jre/Contents/Home"' 'LOCAL_JRE_PATH="${jdk21}"' \
      --replace-fail 'LOCAL_JRE_PATH="$DIR/jre"' 'LOCAL_JRE_PATH="${jdk21}"'
    makeWrapper $out/share/kotlin-lsp.sh $out/bin/kotlin-lsp

    runHook postInstall
  '';
})
```

## Wrapping up

What started as a quick version bump ended up touching three different parts of the derivation.
The native library was the main surprise - I honestly expected kotlin-lsp to stay purely JVM-based for longer.
But `autoPatchelfHook` made that part almost painless once I figured out what was going on.

The bigger takeaway for me is about depending on vendor-hosted binaries at all.
JetBrains removing old releases without warning is a good reminder that the derivation isn't the only thing you're depending on.
