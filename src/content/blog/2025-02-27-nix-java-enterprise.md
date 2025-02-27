---
title: "NixOS Meets Enterprise Java: A Cautionary Tale"
description: "In this blog post I explore the challenges of running an enterprise Java application on NixOS, highlighting issues with Gradle support and authenticated resources. I share lessons learned, workarounds, and why NixOS remains a powerful choice for managing infrastructure despite these hurdles."
pubDate: "2025-02-27"
image: "nixos-java.png"
---

[NixOS](https://nixos.org) is an incredible operating system that brings reproducibility and declarative configuration to an entirely new level.
However, when you step into the enterprise world, particularly with Java-based applications, things start to get tricky.
In this blog post, I want to share my experiences running a Java-based project on a Hetzner server with NixOS.
What seemed like a promising setup quickly turned into a challenge, primarily due to two major pain points:

1. **Packaging Java applications is difficult (especially with [Gradle](https://gradle.org)).**
2. **Authenticated resources are an afterthought.**
3. **Lack of good documentation focused on dealing with the unique challenges of Enterprise environments.**

This post is intended to serve as a warning for those considering NixOS in an enterprise environment and to share the solution we ultimately landed on.

## The Initial Plan

We are a small team and wanted to run the application in a cost-effective way.
Furthermore, we only needed a Java backend and a database, so managed Kubernetes felt like overkill.
For that reason, we decided to run the app on a [Hetzner](https://hetzner.com) server.

The plan was to:

- Use [nixos-anywhere](https://github.com/nix-community/nixos-anywhere) to set up NixOS on the Hetzner server.
- Use [comin](https://github.com/nlewo/comin) to manage the server in a GitOps fashion.
- Package the Java application as a Nix package.
- Define a systemd service that uses the Java application's Nix package to run the service.

By doing this, we hoped to leverage NixOS’s reproducibility and declarative approach to configuration management, ensuring that our deployment environment remained consistent across different stages of development and production.
Additionally, using comin would allow us to maintain infrastructure as code, keeping server configuration versioned and auditable.

Unfortunately, things did not go as smoothly as expected.

## Problems We Encountered

### 1. Creating a Nix package for a non-trivial Java application

Gradle build support has improved drastically over the past year, and I have [blogged about it already](/blog/2025/01/02/gradle-nix).
However, it still has its limitations.

Our first hurdle appeared when we attempted to package our application.
We had Gradle’s [configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html) enabled, but the way Gradle build support captures dependencies in Nix is incompatible with the configuration cache.
Disabling it resolved the issue, and I later proposed a fix to nixpkgs, which I detailed in another [blog post](/blog/2025/02/19/nixpkgs-gradle-optimization).

Once past the configuration cache issue, we encountered another challenge—handling build-time dependencies.
Our application relies on the [jOOQ framework](https://www.jooq.org) for generating database access code, requiring a running PostgreSQL database during the build process.
This setup is quite common in enterprise Java environments, where database-backed code generation occurs as part of the build process.
Typically, teams solve this by running a temporary PostgreSQL instance in a container.
Unfortunately, due to Nix’s strict sandboxing, running [Docker](https://docker.com) or [Podman](https://podman.io) within a Nix build is practically impossible.

We then attempted to use PostgreSQL from nixpkgs directly on the build host, leveraging [postgresqlTestHook](https://nixos.org/manual/nixpkgs/stable/#sec-postgresqlTestHook).
However, this hook starts PostgreSQL with TCP connections disabled, as the documentation warns:

> **postgresqlEnableTCP:** set to 1 to enable TCP listening. Flaky; not recommended.

Connecting to the PostgreSQL socket via JDBC proved unreliable, and after numerous attempts, we decided to move on to tackling other problems, planning to come back to this later.

Another issue arose with our use of the [Gradle protobuf plugin](https://github.com/google/protobuf-gradle-plugin) in combination with the [gRPC protobuf plugin](https://github.com/grpc/grpc-java).
Under normal circumstances, Gradle fetches the [gRPC plugin from Maven Central](https://central.sonatype.com/artifact/io.grpc/protoc-gen-grpc-java) and configures protobuf to use it for code generation.
However, when running inside Nix, all dependencies—including the gRPC protobuf plugin—are stored in the Nix store, which is read-only.
As a result, the build failed because protoc-gen-grpc-java could not be executed from within the store.

We attempted several workarounds:

- Copying the plugin from the Nix store to the workspace before execution.
- Fetching it from Maven Central using [fetchmavenartifact](https://github.com/NixOS/nixpkgs/blob/54ddb7705c5f13620e60f401fff22bf7225f2a7e/pkgs/build-support/fetchmavenartifact/default.nix) (a useful fetcher which is among others not documented in [nixpkgs manual](https://nixos.org/manual/nixpkgs/stable/)) and adding it as a `nativeBuildInput`.

Neither solution worked.
We then explored building the plugin from source within Nix, but this led us down another rabbit hole of trying to package the entire grpc-java project as a Nix derivation.
After half a day of struggling with the Gradle build of that project, we realized that Nix was becoming a distraction rather than a benefit.

At this point, we abandoned the idea of building our Java application within Nix and started exploring alternative approaches.

### 2. Handling Authenticated Resources

Since we couldn’t build the application inside Nix, we opted to build it externally on our CI system (GitHub Actions) and then upload the resulting JAR to Hetzner object storage.
The idea was to have the Nix package fetch the prebuilt JAR and use `makeWrapper` to create an executable package, which could then be referenced from the systemd unit.

The first challenge was figuring out how to fetch the JAR from the object storage.
Hetzner object storage requires authentication, which is typically managed using the [MinIO client](https://min.io/docs/minio/linux/reference/minio-mc.html).
However, when reviewing the available fetchers in Nixpkgs' [build-support](https://github.com/NixOS/nixpkgs/tree/master/pkgs/build-support), we realized that there was no built-in fetcher for MinIO.
The closest alternatives were `fetchurl` and `fetchs3`.

#### Attempting to Use `fetchurl`

Our first approach was to use `fetchurl`, which allows authenticated requests.
Various community suggestions included:[^1][^2][^3]

[^1]: https://discourse.nixos.org/t/nix-authenticated-fetches-from-gitlab-reading-about-related-work/35708

[^2]: https://github.com/NixOS/nixpkgs/issues/32732

[^3]: https://github.com/NixOS/nixpkgs/issues/41000

- Using `netrcImpureEnvVars` to forward environment variables into the Nix build sandbox and then writing a `.netrc` file to handle authentication.
- Configuring `curlOpts` to point to a preconfigured `.netrc` file accessible from the Nix sandbox using `nix.settings.extra-sandbox-paths`.

Neither of these approaches worked.
Since the package was referenced by a systemd unit within the NixOS system configuration, we encountered a chicken-and-egg problem: in order to build the system configuration, we needed authentication details.
However, applying those details required building the system first.
Additionally, `.netrc` only supports username-password authentication, whereas S3-compatible storage requires a dedicated authentication header, making `.netrc` an unviable solution.

#### Exploring `fetchs3` and Writing a Custom Fetcher

Next, we examined [fetchs3](https://github.com/NixOS/nixpkgs/blob/555702214240ef048370f6c2fe27674ec73da765/pkgs/build-support/fetchs3/default.nix), which was designed for AWS S3.
While similar, Hetzner’s object storage required different authentication handling.
We quickly realized we would need to write our own fetcher, inspired by `fetchs3`, but using the MinIO client instead of AWS CLI:

```nix
{
  lib,
  runCommand,
  minio-client,
}:
lib.fetchers.withNormalizedHash { } (
  {
    host,
    alias,
    access_key,
    secret_key,
    file,
    outputHash,
    outputHashAlgo,
    recursiveHash ? false
  }:

  runCommand "${alias}/${file}"
      {
        nativeBuildInputs = [minio-client];

        inherit outputHash outputHashAlgo;
        outputHashMode = if recursiveHash then "recursive" else "flat";

        preferLocalBuild = true;

      }
        ''
          TEMP_DIR=$(mktemp -d)
          trap 'rm -rf "$TEMP_DIR"' EXIT
          mkdir -vp $TEMP_DIR/{config,download}
          export MC_CONFIG_DIR=$TEMP_DIR/config
          mc alias set ${alias} ${host} ${access_key} ${secret_key}
          mc ls ${alias}
          mc cp ${alias}/${file} $TEMP_DIR/download/
          cp $TEMP_DIR/download/* $out
        ''
)
```

Once we had our custom fetcher in place, we were finally able to retrieve the JAR and create an executable nix package from it. This package could then be reference it in our systemd unit:

```nix
{
  lib,
  stdenvNoCC,
  makeWrapper,
  fetchminio,
  jre,
  ...
}: stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "awesome-app";
  version = "0.0.1";

  src = fetchminio {
    host = "https://fsn1.your-objectstorage.com";
    alias = "myminio";
    file = "mybucket/${finalAttrs.name}.jar";
    access_key = "put-access-key-here";
    secret_key = "put-secret-key-here";
    outputHash = "3e720c3074ed02f695e58764e601d4d994f0edb21a8e5a0d40df9bcc9c903be1";
    outputHashAlgo = "sha256";
  };

  nativeBuildInputs = [makeWrapper];

  dontBuild = true;
  dontCheck = true;
  dontUnpack = true;

  installPhase = ''
    mkdir -pv $out/{bin,share/awesome-app}
    cp ${finalAttrs.src} $out/share/awesome-app/${finalAttrs.name}.jar
    makeWrapper ${lib.getExe jre} $out/bin/awesome-app \
      --add-flags "-jar $out/share/awesome-app/${finalAttrs.name}.jar"
  '';
})
```

However, this introduced a new issue:

:::warning
Using `fetchminio` as shown above will result in the access key and secret key ending up in the world readable nix store!
:::

To authenticate with MinIO, we needed to pass an access key and secret key to the client.
Our fetcher accepted these parameters, but storing credentials in the Nix package was not an option—doing so would expose them in the Git history and the world-readable Nix store.
Once again, we faced Nix's fundamental limitation: it lacks a secure, built-in way to handle authentication when fetching resources during builds.

At this point, we realized that fetching authenticated resources directly within Nix derivations was impractical.
We needed an alternative solution.

## The Solution We Settled On

After much trial and error, we realized that insisting on packaging everything as a Nix package was not a viable approach.
We had already determined that building our Java application inside Nix was impractical, leading us to build it externally and push it to Hetzner object storage.
However, the challenge remained: how could we securely retrieve the prebuilt application package without making it publicly accessible?

Instead of trying to fetch the application as part of the Nix package build process, we opted to download it at runtime.
This turned out to be a much simpler and more flexible approach.
Since we had already written Nix code to download resources via MinIO for our fetcher, we adapted this logic into a one-shot systemd unit.
This unit runs before the main application systemd service starts, ensuring that the application binary is securely retrieved and made available.
Here's what our final solution looks like:

```nix
{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.awesome-app;
in {
  options.services.awesome-app = {
    enable = lib.mkEnableOption "awesome-app";
  };

  config = let
    user = "awesome-app";
    group = "awesome-app";
    workDir = "/var/lib/awesome-app";

    downloadScript = pkgs.writeShellApplication {
      name = "awesome-app-download.sh";
      runtimeInputs = [pkgs.minio-client];

      text = ''
        MINIO_ACCESS_KEY=$(cat ${config.sops.secrets."hetzner-access-key".path})
        MINIO_SECRET_KEY=$(cat ${config.sops.secrets."hetzner-secret-key".path})

        mc alias set myminio https://fsn1.your-objectstorage.com "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
        mc cp myminio/mybucket/awesome-app-${cfg.version}.jar .

        ln -fsn awesome-app-${cfg.version}.jar awesome-app.jar

        # clean up all but the 5 newest jars
        # shellcheck disable=SC2010 # ls | grep does not work for file names with non alpha-numeric characters
        ls -tp | grep '^awesome-app-' | tail -n +6 | xargs -d '\n' rm --
      '';
    };
  in lib.mkIf cfg.enable {
    sops.secrets."hetzner-access-key".owner = user;
    sops.secrets."hetzner-secret-key".owner = user;

    users.users.${user} = {
      isSystemUser = true;
      group = group;
      home = workDir;
      createHome = true;
    };

    users.groups.${group} = {};

    systemd.services = {
      awesome-app-download = {
        after = [ "network-online.target" ];
        wants = [ "network-online.target" ];
        wantedBy = [ "multi-user.target" ];

        serviceConfig = {
          Type = "oneshot";
          User = user;
          Group = group;
          WorkingDirectory = workDir;
          ExecStart = lib.getExe downloadScript;
        };
      };

      awesome-app = {
        after = [ "awesome-app-download.target" ];
        wants = [ "awesome-app-download.target" ];
        wantedBy = ["multi-user.target" ];

        serviceConfig = {
          User = user;
          Group = group;
          WorkingDirectory = workDir;
          ExecStart = "${lib.getExe pkgs.jre} -jar ./awesome-app.jar";
        };
      };
    };
  };
}
```

By handling this at the **NixOS configuration layer** rather than the **Nix package layer**, we gained access to additional tools like [sops](https://github.com/getsops/sops) and [sops-nix](https://github.com/Mic92/sops-nix).
These tools allowed us to securely manage authentication credentials, making the access keys and secrets available in a secure and reproducible manner.
This shift simplified our deployment while maintaining security and compliance.

## Conclusion

If you are running applications on bare metal or virtual machines, **NixOS is the best option for managing your host** in my opinion. Its declarative configuration and reproducibility make it far superior to traditional package management and configuration tools such as [Puppet](https://www.puppet.com), [Chef](https://chef.io) or [Ansible](https://ansible.com). However, enterprise Java environments introduce unique challenges that require careful planning.

Our difficulties arose from a particularly tricky combination of choices: packaging a Gradle-based Java application, handling database-backed code generation, and working with private object storage. While these challenges were significant, they were not inherent flaws in NixOS itself—rather, they were a result of mismatches between Java’s ecosystem and Nix’s strict approach to builds.

For teams considering NixOS in an enterprise Java setting, our experience highlights the importance of understanding where to draw the line between what should be managed as a Nix package and what should be handled at the system configuration level. With the right approach, NixOS remains a powerful and sane choice for managing infrastructure, offering benefits that few other systems can match.

If you find yourself struggling with NixOS or Gradle, I offer [consulting services](/services) for both NixOS and Gradle and am happy to help.
