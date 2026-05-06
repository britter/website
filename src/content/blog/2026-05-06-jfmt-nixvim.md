---
title: "Packaging jfmt for NixVim: The Path to nixpkgs"
description: "Packaging the jfmt Java formatter as a native binary for NeoVim: from a JVM wrapper through weeks of reproducibility debugging to a statically-linked GraalVM binary."
topics: ["NixOS", "Java", "Neovim"]
---

A few months ago I started using [jfmt](https://github.com/bmarwell/jfmt) to format Java source code from the command line.
My goal was to wire it into [Neovim](https://neovim.io) as a formatting source via [none-ls](https://github.com/nvimtools/none-ls.nvim), so that saving a Java file would automatically format it using the Eclipse formatter, the same formatter that most Java teams run in their CI pipelines.
Since I manage my Neovim setup with [NixVim](https://github.com/nix-community/nixvim), that meant packaging jfmt with Nix first.

What followed was a several-week journey through Maven build internals, Nix fixed-output derivations, and eventually GraalVM native images.
This post documents the whole thing.

## First: Building maven_4

nixpkgs has [`buildMavenPackage`](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/build-maven-package/default.nix) for building Maven projects with Nix.
It works in two phases: first a network-enabled fixed-output derivation fetches and caches all Maven dependencies, then a sandboxed build uses that cache to compile the project offline.
jfmt requires Maven 4, though, and Maven 4 isn't packaged in nixpkgs yet.
Before I could use `buildMavenPackage` for jfmt, I needed a derivation for Maven 4 itself.

Fortunately nixpkgs already ships Maven 3, so I could override it rather than writing a derivation from scratch:

```nix
{
  fetchurl,
  maven,
}:
maven.overrideAttrs (
  final: _prev: {
    version = "4.0.0-rc-5";
    src = fetchurl {
      url = "mirror://apache/maven/maven-4/${final.version}/binaries/apache-maven-${final.version}-bin.tar.gz";
      hash = "sha256-7OalyZ09BBx25/7RgU656jogoSC8s8I1pz0sTo2xbKE=";
    };
  }
)
```

Because `overrideAttrs` preserves all attributes of the parent derivation, `maven_4` automatically inherits `buildMavenPackage` from the Maven 3 derivation via `passthru`.
That means `maven_4.buildMavenPackage` works out of the box, at least to start with.
More on why that eventually needed changing below.

Getting Maven 4 into nixpkgs proper is [the first step](https://github.com/NixOS/nixpkgs/pull/516100) towards eventually upstreaming jfmt as well.

## Starting with a JVM Wrapper

jfmt does ship [binary releases](https://github.com/bmarwell/jfmt/releases), and in theory I could have packaged those the same way I packaged [kotlin-lsp](/blog/2025/11/15/kotlin-lsp-nixvim): fetch the release archive and wrap the binary with `makeWrapper`.
[Part 2 of that series](/blog/2026/03/20/kotlin-lsp-nixvim-pt2) is a good reminder of why that approach has risks.
You're implicitly depending on the upstream continuing to host the archive at that URL, and a version bump can break your derivation without you changing anything.
Building from source gives more control over what ends up in the output and makes it easier to apply patches when needed, as you'll see below.

jfmt is a Maven project targeting Java 25 with preview features enabled.
The result of the Maven build is a JAR that you wrap with `makeWrapper` to produce a usable binary:

```nix
maven_4.buildMavenPackage {
  pname = "jfmt";
  version = "0.1.0-rc1";

  src = fetchFromGitHub { owner = "bmarwell"; repo = "jfmt"; rev = "9870374..."; };
  mvnHash = "sha256-...";
  mvnJdk = jdk25_headless;

  mvnParameters = lib.escapeShellArgs [
    "-Dspotless.skip=true" "-pl" "cli" "-am" "dependency:copy-dependencies"
  ];

  installPhase = ''
    mkdir -p $out/{bin,lib}
    cp cli/target/jfmt-*.jar $out/lib
    cp -r cli/target/dependency/* $out/lib
    makeWrapper ${jdk25_headless}/bin/java $out/bin/jfmt \
      --add-flags "-classpath '$out/lib/*' --enable-preview io.github.bmarwell.jfmt.JFmt"
  '';
}
```

jfmt uses [JReleaser](https://jreleaser.org) to assemble distribution archives, and JReleaser's Maven plugin is bound to the `package` phase, which means it runs during every build, not just during a release.
This turned out to matter quite a bit.

## Down the Reproducibility Rabbit Hole

Many language-specific builders in nixpkgs use a fixed-output derivation to pre-fetch dependencies in a network-enabled environment before the actual sandboxed build runs.
`buildGoModule`, `buildRustPackage`, and `buildMavenPackage` all follow this pattern.
The requirement is always the same: the FOD must produce identical output on every machine and every rebuild, because its hash is what Nix uses to verify it.
If anything non-deterministic ends up inside it, the hash changes between machines and the build breaks.
jfmt's did: the build would pass locally but consistently fail on CI with a hash mismatch in the dependency FOD.

The first version of the derivation used the `-Prelease` Maven profile, which runs JReleaser's assemble goal and produces ZIP and TAR archives.
Those archives embed timestamps, making the Maven cache non-deterministic.
Switching away from `-Prelease` and using `dependency:copy-dependencies` instead got rid of that source of instability.

Even then, JReleaser's assemble execution is declared in the default build section of `cli/pom.xml`, so it runs with every `mvn package` invocation regardless of which profiles are active.
As a workaround I patched `cli/pom.xml` to strip the JReleaser plugin from the build entirely, while at the same time filing a [feature request](https://github.com/jreleaser/jreleaser/issues/2115) upstream asking for a flag to make JReleaser's output reproducible.
That feature was implemented and shipped in JReleaser 1.24.0, so the [current patch](https://github.com/britter/nix-configuration/blob/de29395c70bba3a5d2b416b97bd8e5cc6955944d/packages/jfmt-java/0001-bump-JReleaser-to-1.24.0-and-enable-reproducible-outputs.patch) is much less invasive: it just bumps the JReleaser version and sets `<reproducible>true</reproducible>` in the plugin configuration.

With JReleaser out of the picture, the package built reproducibly on my machine.
But it kept failing on GitHub Actions with a hash mismatch in the dependency fixed-output derivation.

## Chasing a CI-Only Hash Mismatch

The Nix store on GitHub Actions isn't directly accessible, and exporting it as a build artifact doesn't work because it's far too large.
My theory was that the difference might be caused by NixOS vs. Nix running on top of Ubuntu, so I wanted to reproduce the failure on a non-NixOS Linux system.
I used [quickemu](https://github.com/quickemu-project/quickemu) to spin up a Fedora VM and ran `nix build github:britter/nix-configuration#jfmt-java` inside it.
The hash mismatch appeared immediately.

The next step was to diff the two dependency fixed-output derivations: the one built on my host and the one built in the VM.
The problem is that `buildMavenPackage` creates the dependency FOD as a purely internal derivation.
It's not exposed via `passthru` and there's no dedicated flake output for it, so there's no way to build it in isolation with a plain `nix build` command.

To get my hands on both FODs I used the following process in the VM:

1. Clone the repository and update the `mvnHash` to the value the VM produces, then `nix build .#jfmt-java`.
2. Find the dependency FOD drv with `nix derivation show .#jfmt-java`. The output is a large JSON object; the relevant part is in `inputDrvs`, where the maven-deps derivation appears as a key:

```json
"inputDrvs": {
  "/nix/store/mf3j8sqygzd7665q2nkvq75chl30cwjw-maven-deps-jfmt-0.1.0-rc1.drv": {
    "dynamicOutputs": {},
    "outputs": [ "out" ]
  },
  ...
}
```

3. Run `nix derivation show` on that drv path to find the built store path:

```json
{
  "/nix/store/mf3j8sqygzd7665q2nkvq75chl30cwjw-maven-deps-jfmt-0.1.0-rc1.drv": {
    "outputs": {
      "out": {
        "path": "/nix/store/nj31xa4m929i5fgjayrbz4gxl822wsqy-maven-deps-jfmt-0.1.0-rc1",
        "method": "nar",
        "hashAlgo": "sha256",
        "hash": "752f87769a253241c98d9b4c..."
      }
    }
  }
}
```

4. From my host, copy that store path out of the VM:

```sh
nix copy --from ssh://fedora-vm /nix/store/nj31xa4m929i5fgjayrbz4gxl822wsqy-maven-deps-jfmt-0.1.0-rc1
```

With both FOD store paths now on my host I could run [diffoscope](https://diffoscope.org/) on them.
It pointed at a `.meta` directory at the root of the local Maven repository, something I had never seen before.
So I started digging.

It turned out to be created by the [Remote Repository Filtering](https://maven.apache.org/resolver/remote-repository-filtering.html) (RRF) feature in Apache Maven Resolver.
It caches a copy of `prefixes.txt` downloaded from Maven Central: a list of known GroupId path prefixes used to avoid sending resolution requests for artifacts that don't exist in a repository.
The directory contains `prefixes-central.txt` (the downloaded prefix list, which Maven Central updates continuously as new artifacts are published) and a `resolver-status.properties` file that records wall-clock timestamps of when the cache was last refreshed.
Both change between machines and between builds, which breaks the fixed-output derivation.

RRF has been in Maven Resolver since 2022, but it was opt-in until it was [enabled by default](https://github.com/apache/maven-resolver/commit/a78647b5a6) in maven-resolver 2.0.11, released September 2025.
Maven 4.0.0-rc-5, the exact version used in this derivation, bundles resolver 2.0.13.
Maven 3.9.x bundles the 1.9.x line where RRF is still opt-in, so the problem simply doesn't appear there.

The fix itself was a one-liner: delete `.meta` as part of the dependency FOD's cleanup phase, right alongside the existing removal of `.lastUpdated` files, `resolver-status.properties`, and `_remote.repositories`:

```bash
find $out -type f \( \
  -name \*.lastUpdated \
  -o -name resolver-status.properties \
  -o -name _remote.repositories \) \
  -delete

# Remove meta directory that keeps changing between rebuilds
rm -rf $out/.m2/.meta
```

The problem was getting that one-liner into `buildMavenPackage`.
There's no way to extend its cleanup filter from the outside, so I had to copy the builder into my configuration and patch it directly.
And since that copy is no longer the one inherited from the Maven 3 derivation via `passthru`, I also had to extend `maven_4` to explicitly override `buildMavenPackage`, pointing it at the patched copy.
`overrideAttrs`'s `final.finalPackage` resolves to the fully-overridden `maven_4` derivation at the fixed-point, so the patched builder ends up correctly wired to Maven 4:

```nix
maven.overrideAttrs (
  final: _prev: {
    # ...version and src as before...
    passthru.buildMavenPackage = callPackage ./build-maven-package.nix {
      maven = final.finalPackage;
    };
  }
)
```

Not elegant, but it finally made the hash stable everywhere.

So after all that, I had a reproducible package, but it turned out to be too slow to use as a format-on-save hook in Neovim.
Every time a file was saved, Neovim would spawn a new JVM process, wait for it to initialize, run jfmt, and only then write the formatted result back.
That JVM startup time is noticeable: the editor hangs for a moment after every save.
Tools like Gradle work around this by keeping a warm JVM running in the background via the Gradle Daemon, but jfmt has no equivalent infrastructure, and honestly expecting it to would be asking too much from a formatter.
The solution was to get rid of the JVM entirely.

## Going Native

jfmt's upstream supports building a [GraalVM](https://www.graalvm.org) native image: a fully self-contained binary with no JVM dependency at runtime.
On Linux, the recommended approach is to link it statically against [musl libc](https://musl.libc.org), producing a binary that runs on any Linux system without any native library requirements.

nixpkgs ships `graalvmPackages.graalvm-ce-musl`, a GraalVM CE build whose `native-image` wrapper is pre-configured with a musl-gcc toolchain and the appropriate C library paths.
jfmt's own `pom.xml` already has a `dist-linux` Maven profile that adds `--static --libc=musl` to the native-image build arguments, and this profile activates automatically when Maven detects it's running on Linux.

So the entire native build boils down to swapping the JDK and activating the right Maven profile:

```nix
maven_4.buildMavenPackage {
  # ...same src and patches...

  mvnJdk = graalvmPackages.graalvm-ce-musl;
  mvnParameters = lib.escapeShellArgs [
    "-Dspotless.skip=true" "-Pnative" "-pl" "cli" "-am"
  ];
  nativeBuildInputs = [ graalvmPackages.graalvm-ce-musl ];

  installPhase = ''
    mkdir -p $out/bin
    find cli/target -maxdepth 1 -type f -perm /0111 -name 'jfmt*' \
      -exec install -m755 {} $out/bin/jfmt \;
  '';
}
```

`-Pnative` activates `native-maven-plugin`, which calls `native-image` at `$JAVA_HOME/bin/native-image` during the `package` phase.
With `mvnJdk` set to `graalvm-ce-musl`, `JAVA_HOME` points to the GraalVM installation whose `native-image` already knows about the musl toolchain.
The `dist-linux` profile kicks in automatically and adds the static linking flags.

Running `nix build .#jfmt-java` the first time produced:

```
./result/bin/jfmt: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, stripped
```

And `./result/bin/jfmt --version` printed `jfmt 0.1.0-rc1`.
First attempt, no debugging required.
I was expecting to spend the better part of a week on this.

The native binary also made most of the earlier complexity disappear.
No JVM wrapper.
No classpath management.
No test JARs in the output.
The forked `buildMavenPackage` with its custom filter is still needed for the dependency cache phase, but the installed package itself is a single static binary with instant startup.

## Configuring jfmt in NixVim

With the package in place, wiring jfmt into Neovim as a format-on-save source is done through none-ls.
NixVim exposes a `none-ls.luaConfig.post` hook for registering custom sources that aren't built into none-ls itself:

```nix
programs.nixvim.plugins.none-ls.luaConfig.post = # lua
  ''
    do
      local null_ls = require("null-ls")
      local helpers = require("null-ls.helpers")
      local root_dir = vim.fs.root(0, {'gradlew', '.git', 'mvnw'})

      local args = {"write", "$FILENAME"}
      local config_file = vim.fs.joinpath(root_dir, 'gradle/config/eclipse-formatter.xml')
      if vim.uv.fs_stat(config_file) then
        table.insert(args, "--config-file")
        table.insert(args, config_file)
      end

      local jfmt = {
        method = null_ls.methods.FORMATTING,
        filetypes = { "java" },
        name = "jfmt",
        generator = helpers.formatter_factory({
          command = "${pkgs.jfmt-java}/bin/jfmt",
          to_temp_file = true,
          args = args,
        }),
      }
      null_ls.register(jfmt)
    end
  '';
```

A few things worth noting here.
The formatter uses `to_temp_file = true`, which tells none-ls to write the buffer content to a temp file before invoking jfmt, then read the result back.
This is necessary because jfmt is configured as an auto-format-on-save command: without it, Neovim calls the formatter before the file has been written to disk, so jfmt would format the previous version of the file.
jfmt also has a `print` subcommand that writes the formatted result to stdout instead of back to the file, but none-ls enforces `from_temp_file` whenever `to_temp_file` is set, so the `write` subcommand is the right choice here.

The config also looks for an Eclipse formatter configuration file at `gradle/config/eclipse-formatter.xml` relative to the project root and passes it to jfmt via `--config-file` if it exists.
That path is just a convention I use in my own projects — you'll want to adjust it to wherever your project stores its Eclipse formatter settings, or remove that part entirely if you're happy with jfmt's defaults.

## Conclusion

What started as "I'd like Java files to format on save in Neovim" turned into a multi-week investigation into Maven 4 internals, Nix fixed-output derivations, and a Maven Resolver feature I had never heard of.
The native binary was the happy ending: a statically-linked executable that starts instantly and took less than an hour to get working, compared to weeks spent on the JVM wrapper.
The package currently lives in my personal configuration, but the plan is to upstream it once [nixpkgs#516100](https://github.com/NixOS/nixpkgs/pull/516100) gets Maven 4 into nixpkgs, which is the prerequisite for jfmt to follow.

If you need help packaging JVM applications with Nix or setting up a reproducible NixOS development environment, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch!
