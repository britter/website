---
title: "Packaging kotlin-lsp for NixVim (Part 3)"
description: "JetBrains reshuffled the whole kotlin-lsp distribution into the IntelliJ platform bundle. Here is what it took to keep the Nix derivation working."
topics: ["NixOS", "Kotlin", "Neovim"]
---

This is now the third post in what has quietly turned into a series.
In [part 1](/blog/2025/11/15/kotlin-lsp-nixvim) I packaged [kotlin-lsp](https://github.com/Kotlin/kotlin-lsp) for [NixVim](https://github.com/nix-community/nixvim), and in [part 2](/blog/2026/03/20/kotlin-lsp-nixvim-pt2) a version bump surprised me with native libraries that needed patching.
So when I sat down for what I assumed would be another quick version bump, I really should have known better.
kotlin-lsp is still in alpha, and it shows.
Every time I update it, something structural has changed underneath me.
This time it wasn't a native library or a missing JRE - it was the entire shape of the distribution.

A nice surprise this time was that the series turned out to be useful to other people.
Someone [opened an issue](https://github.com/britter/nix-configuration/issues/169) sharing the derivation they'd got working for a newer release, which gave me a solid head start on figuring out what had changed.
That's exactly the kind of thing that makes writing these posts worthwhile.

## From a flat zip to the IntelliJ platform bundle

Up to now, kotlin-lsp shipped as a flat zip under `download-cdn.jetbrains.com/kotlin-lsp/`, containing not much more than a `lib/` directory, the `native/` directory from part 2, and the `kotlin-lsp.sh` startup script.

The newer releases don't do that anymore.
Instead [JetBrains](https://www.jetbrains.com) now ships the full IntelliJ-platform **kotlin-server** bundle, hosted at a different path entirely:

```nix
src = fetchzip {
  url = "https://download-cdn.jetbrains.com/language-server/kotlin-server/${finalAttrs.version}/kotlin-server-${finalAttrs.version}.tar.gz";
  sha256 = "sha256-kxV0AU1TEi7U84boc45V7GJNJzo3uWraHEo6q4Kd9+U=";
};
```

Two things changed here.
The download moved from `.../kotlin-lsp/VER/kotlin-lsp-VER-linux-x64.zip` to `.../language-server/kotlin-server/VER/kotlin-server-VER.tar.gz`.
And the archive is now a proper tarball with a single top-level directory, so I could finally drop the `stripRoot = false;` that the old flat zip required.

Unpacking it, this is clearly no longer "just the language server".
It's the same layout you'd find in an [IntelliJ IDEA](https://www.jetbrains.com/idea/) installation - `bin`, `lib`, `modules`, `plugins`, `product-info.json` and friends.
The "partially closed-source, heavily depends on parts of IntelliJ" disclaimer from the first post has become very literal.

## A new entrypoint and the JRE, again

The old `kotlin-lsp.sh` is still in the bundle, but it's deprecated.
If you read it, all it does now is `exec` a new launcher: `bin/intellij-server`.
That's the actual entrypoint for the IntelliJ-platform server, so there's no reason to go through the shell script anymore.
I wrap `bin/intellij-server` directly:

```sh
makeWrapper $out/share/kotlin-lsp/bin/intellij-server $out/bin/kotlin-lsp
```

That new launcher also changes how the JRE is found, and Java version churn is becoming a running theme in this series.
In part 1 I used `jdk21`, and that held through part 2.
This bundle targets Java 25 - the runtime it ships is `25.0.2` - so `jdk21` won't cut it anymore.

More interesting is _how_ the bundle expects to find its JRE.
In part 2 the startup script hardcoded a `./jre` path and ignored `JAVA_HOME`, and I worked around that by patching the two `LOCAL_JRE_PATH` lines with `substituteInPlace`.
The IntelliJ-platform launcher does it differently: it looks for a `jbr/` directory right next to itself, the same way a real IntelliJ install ships a bundled [JetBrains Runtime](https://github.com/JetBrains/JetBrainsRuntime) (JBR) - JetBrains' own fork of [OpenJDK](https://openjdk.org) with patches for their IDEs.

The bundle ships that JBR, but I don't want a JDK that didn't come from nixpkgs ending up in the final derivation - that's the whole point of building this declaratively.
So instead of copying the bundled `jbr/` into the output, I leave it out and point a `jbr/` symlink at nixpkgs' `jdk25`:

```sh
ln -s ${jdk25}/lib/openjdk $out/share/kotlin-lsp/jbr
```

This is nicer than the `substituteInPlace` dance from part 2.
Instead of rewriting the launcher's logic, I just satisfy the layout it already expects.
The `lib/openjdk` suffix is where nixpkgs' JDK derivations put the actual Java home, so that's what the `jbr` link has to resolve to.

With that, the whole `installPhase` becomes:

```sh
mkdir -p $out/bin $out/share/kotlin-lsp
cp -r bin build.txt kotlin-lsp.sh lib license modules plugins product-info.json $out/share/kotlin-lsp
ln -s ${jdk25}/lib/openjdk $out/share/kotlin-lsp/jbr

makeWrapper $out/share/kotlin-lsp/bin/intellij-server $out/bin/kotlin-lsp
```

## Actually checking that it starts

There's one thing that has bugged me from the beginning: I never really _verified_ the result beyond an `ldd` sanity check and firing up [Neovim](https://neovim.io) by hand.
This led to an expensive development loop, because I always had to rebuild my whole system configuration, then start Neovim and open a Kotlin file to see if things were working.

There are many ways to add tests to derivations, but the usual sanity check tool in nixpkgs for this is `versionCheckHook`.
It runs the built binary with `--version` and asserts it prints something sensible.
But kotlin-lsp has no `--version` - it only speaks [LSP](https://microsoft.github.io/language-server-protocol/) over stdio.

So instead - with the help of [Claude Code](https://claude.ai/code) - I wrote a small `installCheckPhase` that drives a minimal LSP `initialize` handshake and asserts the server replies with a framed [JSON-RPC](https://www.jsonrpc.org/) message:

```sh
doInstallCheck = true;
installCheckPhase = ''
  runHook preInstallCheck

  req='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}'
  printf 'Content-Length: %d\r\n\r\n%s' "''${#req}" "$req" \
    | timeout 120 $out/bin/kotlin-lsp --stdio > response.txt 2>/dev/null || true

  grep -q '"jsonrpc"' response.txt || {
    echo "kotlin-lsp did not respond to an LSP initialize request" >&2
    exit 1
  }

  runHook postInstallCheck
'';
```

LSP frames each message with a `Content-Length` header followed by `\r\n\r\n` and the JSON body, which is what the `printf` builds.
If the server answers with anything containing `"jsonrpc"`, we know the JVM actually launched, the `jbr` symlink resolved, and the patched native libraries loaded.
That's exactly where breakage tends to hide, so it's a much better signal than "the binary exists".

## The updated derivation

Putting it all together ([full source on GitHub](https://github.com/britter/nix-configuration/blob/bf6751dd46ff2763ac97e658622f5f8c7493cd08/packages/kotlin-lsp/default.nix)):

```nix
{
  stdenv,
  stdenvNoCC,
  fetchzip,
  makeWrapper,
  jdk25,
  autoPatchelfHook,
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "kotlin-lsp";
  version = "262.8190.0";

  src = fetchzip {
    url = "https://download-cdn.jetbrains.com/language-server/kotlin-server/${finalAttrs.version}/kotlin-server-${finalAttrs.version}.tar.gz";
    sha256 = "sha256-kxV0AU1TEi7U84boc45V7GJNJzo3uWraHEo6q4Kd9+U=";
  };

  nativeBuildInputs = [
    makeWrapper
    autoPatchelfHook
  ];

  buildInputs = [
    jdk25
    stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin $out/share/kotlin-lsp
    cp -r bin build.txt kotlin-lsp.sh lib license modules plugins product-info.json $out/share/kotlin-lsp
    ln -s ${jdk25}/lib/openjdk $out/share/kotlin-lsp/jbr

    makeWrapper $out/share/kotlin-lsp/bin/intellij-server $out/bin/kotlin-lsp

    runHook postInstall
  '';

  # kotlin-lsp has no --version, so instead of versionCheckHook drive a
  # minimal LSP initialize handshake over stdio and assert the server
  # replies with a framed JSON-RPC message. This exercises the JVM launch
  # and the patched native libraries, which is where breakage tends to hide.
  doInstallCheck = true;
  installCheckPhase = ''
    runHook preInstallCheck

    req='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}'
    printf 'Content-Length: %d\r\n\r\n%s' "''${#req}" "$req" \
      | timeout 120 $out/bin/kotlin-lsp --stdio > response.txt 2>/dev/null || true

    grep -q '"jsonrpc"' response.txt || {
      echo "kotlin-lsp did not respond to an LSP initialize request" >&2
      exit 1
    }

    runHook postInstallCheck
  '';
})
```

## Wrapping up

Three posts in, the pattern is pretty clear.
kotlin-lsp is moving fast, and each release feels free to reshape how it's built, launched and distributed.
Every time, nixpkgs has had the right tool ready - `autoPatchelfHook` in part 2, `makeWrapper` and a well-placed symlink here - so the derivation stays small even as the thing it wraps keeps shifting shape.

The one habit I'm taking away from this round is the `installCheckPhase`.
When you're packaging a moving target from pre-built binaries, a build that succeeds tells you almost nothing.
A build that succeeds _and_ answers an LSP handshake tells you it'll probably still work when you open a Kotlin file - and that's worth the handful of extra lines.

I suspect there'll be a part 4.
