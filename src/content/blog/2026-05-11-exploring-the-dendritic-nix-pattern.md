---
title: "Exploring the Dendritic Nix Pattern"
description: "Planning a migration of my NixOS flake configuration to the dendritic pattern: what it is, why I want it, and the pitfalls I found before writing a single line of code."
topics: ["NixOS", "Nix"]
---

I maintain a [NixOS](https://nixos.org) flake configuration that covers several machines: a desktop laptop, a handful of home servers, a Raspberry Pi acting as a reverse proxy, and a standalone home-manager setup on a [Fedora](https://fedoraproject.org) work laptop.
The configuration has grown organically over the past few years and it works, but it has accumulated some structural awkwardness that I've been wanting to address.
The full repository is [on GitHub](https://github.com/britter/nix-configuration) if you want to follow along.

Recently I wanted to add my work laptop as a proper NixOS machine.[^1]
But before I could even think about the technical specifics, I ran into a more fundamental issue with how my configuration is structured.

[^1]: The work laptop needs some proprietary monitoring tools (Kolide and CrowdStrike Falcon Sensor) that require careful setup on NixOS, and Falcon Sensor specifically needs an LTS kernel.

## The Problem With My Current Setup

My configuration uses a module system I originally adopted from [Paul Meyer's NixOS config](https://github.com/katexochen/nixos/tree/36cbf74890fa323774fd0e0a2fc401d68710a8cf) when he was teaching me Nix back in late 2023.
Every module under `modules/` is written in the standard [NixOS module style](/blog/2025/01/09/nixos-modules/): it declares an `enable` option that defaults to `false`, wraps its actual configuration in `lib.mkIf cfg.enable`, and lives behind its own namespace under `my.modules.<name>`.
A central `modules/default.nix` imports every module, so each host imports that one file and the entire module catalogue is available, but disabled.

Enabling specific modules mostly happens in each host's own configuration file.
A host lists the things it wants (`my.modules.nextcloud.enable = true`, `my.modules.vaultwarden.enable = true`, and so on) and provides whatever per-module configuration goes with them.
On top of that, `modules/default.nix` provides a small role-based baseline so that the common stuff doesn't have to be repeated on every machine.
Each host declares `my.host.role = "desktop"` or `"server"`, and the dispatcher enables a handful of defaults per role:

```nix
my.modules = {
  i18n.enable = true;
  networking.enable = true;
} // lib.optionalAttrs (cfg.role == "desktop") {
  fonts.enable = true;
  gaming.enable = true;
  sway.enable = true;
  my-user.enable = true;
} // lib.optionalAttrs (cfg.role == "server") {
  comin.enable = true;
  sops.enable = true;
  ssh-access.enable = true;
};
```

For a while this worked fine.
But the structure has a built-in cost: double bookkeeping.
Every module needs an `enable` option declared, an `lib.mkIf cfg.enable` wrapper around its body, and a corresponding `my.modules.<name>.enable = true` set somewhere (either by the host file or by the role dispatcher) to actually do anything.
Adding a new feature means writing the module _and_ remembering to enable it somewhere.
The boilerplate is small per module but adds up across thirty-plus of them.
And as the configuration grew, the cracks started showing in deeper ways too.

The most painful example is home-manager.
When a desktop machine is set up, the `my-user` module creates the system user, enables home-manager, and imports the home-manager configuration from `../../home`.
That `home/` directory has its own entry point, `home/default.nix`, which enables every feature by default:

```nix
config = {
  my.home = {
    desktop.enable = true;
    java = { enable = true; version = 25; ... };
    rust.enable = true;
    terminal.enable = true;
  };
};
```

This is written for one specific machine: my personal Framework laptop.
It enables sway, gaming, all Java versions, the full desktop setup.
If I wanted to add a second machine with a different user configuration (different identity, different tools, no sway) I would need this entry point to vary per machine.
Do I add more options? Do I create a second entry point file? Do I duplicate `modules/home-manager`?
Every answer makes things messier.

I'm already running into exactly this.
My work laptop runs Fedora and uses my standalone home-manager configuration, which sidesteps `home/default.nix` entirely by pointing directly at a different entry point, `home/benedikt.nix`, with work-specific settings.
The trick works, but it introduces friction in two places.

The first is the `osConfig` argument.
When home-manager runs as a NixOS module, it gives home-manager modules read access to the NixOS configuration through this argument.
That's useful for keeping things DRY: I can define user identity once as a NixOS option and have home-manager modules read it from `osConfig`.
Several of my home-manager modules do exactly that, reading `osConfig.my.user.fullName`, `osConfig.my.user.email`, and `osConfig.my.user.signingKey` to configure git.

In standalone mode, though, there is no NixOS layer, so there is no real `osConfig`.
Home-manager sets it to an empty attribute set.
To keep the same modules working on Fedora, I pass a fake struct via `extraSpecialArgs`:

```nix
extraSpecialArgs = {
  osConfig.my.user = {
    fullName = "Benedikt Ritter";
    email = "benedikt.ritter@chainguard.dev";
    signingKey = "EA363E64382563CF";
  };
};
```

It works, but it's obviously a hack.
The standalone configuration pretends to have a NixOS layer that doesn't exist.

The second is custom packages.
I maintain a few packages in the repository (`jfmt-java`, `gh-get`, `kotlin-lsp`) that aren't in nixpkgs.
On NixOS machines these get picked up through an overlay registered in the flake.
In the standalone home-manager configuration there is no NixOS layer to apply that overlay, so I have to wire them in manually as an inline anonymous module:

```nix
modules = [
  inputs.catppuccin.homeModules.catppuccin
  inputs.nixvim.homeModules.nixvim
  ./home/benedikt.nix
  ({ pkgs, ... }: {
    nixpkgs.overlays = [
      (_self: _super: rec {
        gh-get = pkgs.callPackage ./packages/gh-get { };
        jfmt-java = pkgs.callPackage ./packages/jfmt-java { inherit maven_4; };
        maven_4 = pkgs.callPackage ./packages/maven_4 { };
        kotlin-lsp = pkgs.callPackage ./packages/kotlin-lsp { };
      })
    ];
  })
];
```

Every time I add a new custom package I have to remember to wire it here too.
It's the kind of manual bookkeeping that a better structure should make unnecessary.

This isn't the first time I've run into this kind of awkwardness.
At a previous employer I used macOS, which meant a [nix-darwin](https://github.com/nix-darwin/nix-darwin) configuration alongside the NixOS one, with a parallel `modules/darwin/` directory and a `home/profiles/` system to switch between work and personal identities.
When I [decommissioned that MacBook](https://github.com/britter/nix-configuration/pull/74) the parallel hierarchy went away, but the underlying problem didn't: any machine that doesn't fit the dominant assumption of "NixOS with my personal home configuration" needs a different shape, and the central wiring fights you every time.

The pattern across all of these examples is the same: per-machine work is spread across host files, the role dispatcher, and the home-manager entry point, and any machine that doesn't fit the shape the central wiring assumes needs a workaround to slot into it.

## Discovering the Dendritic Pattern

While thinking about this problem I came across the [dendritic design pattern](https://github.com/Doc-Steve/dendritic-design-with-flake-parts/wiki/Dendritic_Aspects), a way of structuring NixOS flake configurations built around composable features called _aspects_.
The core idea inverts my current approach: instead of machines declaring a role and having a central file decide what's enabled, each machine explicitly imports exactly the aspects it needs.

The mechanism that makes this work is `flake.modules.<class>.<name>`, an option provided by [flake-parts](https://flake.parts) that creates a named module registry.
Every `.nix` file under `modules/` is auto-imported as a flake-parts module via [import-tree](https://github.com/vic/import-tree/tree/c41e7d58045f9057880b0d85e1152d6a4430dbf1), and each one registers an aspect into the registry.
Hosts then import aspects **by name**, not by file path:

```nix
flake.modules.nixos."framework-13" = {
  imports = with inputs.self.modules.nixos; [
    fonts
    gaming
    sound
    sway
    benedikt   # user aspect
  ];
};
```

No `../../../modules/fonts.nix`.
The name `fonts` is a key in the registry.
You can reorganise files freely without updating anything that references them.

The `flake.nix` itself becomes almost trivially simple:

```nix
outputs = inputs:
  inputs.flake-parts.lib.mkFlake { inherit inputs; } (inputs.import-tree ./modules);
```

Everything else lives in the module files.

### What This Buys

There is a deeper benefit beyond explicit imports.
Because aspects are referenced by name rather than file path, each `.nix` file becomes self-contained: it declares everything it needs (external flake inputs, dependent aspects, the options it consumes) and nothing else in the repository needs to know where it lives.
Move a file from `modules/nixos/services/` to `modules/services/networking/` and nothing breaks; the registry contains the same key with a different source location.
There is no central wiring file.
This is what makes a gradual migration feasible at all: each aspect can stand on its own from the moment it's written.

Adding a new machine becomes purely additive.
You write a host file with an import list and you're done.
No central dispatcher to extend, no role-based options to add, no risk of affecting other machines.
Each host's configuration is fully visible at a single glance: every aspect is named in its imports list.

The "enabled vs imported" confusion that comes with the role-based approach disappears.
With options, `my.modules.foo.enable = true` could be set anywhere: in the host, in another module that depends on it, in a central dispatcher.
Tracing what is actually active on a given machine means following option assignments across many files.
With dendritic, the host's import list is the answer.
There is one place to look.

Different machines can share a system base while having entirely different user configurations, without any option wiring.
A "common server" aspect plus one admin user aspect produces a server.
The same common server aspect plus a different admin user aspect produces a different server.
There is no `my.users.<name>.enable = true` pattern needed: the host just imports the user it wants.

A useful side effect of registering everything through `flake.modules`: `nix flake show` actually shows everything.
In my current setup, modules are paths imported inside `nixosConfigurations`.
They never become flake outputs themselves, so the CLI can't see them, even though I went to the trouble of writing them as proper NixOS and home-manager modules.
With dendritic, every aspect is a named entry in `flake.modules.nixos.*` (and `homeManager.*`), every factory is in `flake.factory.*`, and the packages, overlays, and checks all keep their existing flake outputs too.
Tooling that introspects the flake suddenly has visibility into the configuration's actual structure.

And the kind of mess I described in the Fedora setup goes away even if I never migrate that machine to NixOS.
The standalone home-manager configuration becomes a host aspect like any other.
The `osConfig` mock is replaced with a `let` binding that both NixOS and standalone contexts close over.
The manual package wiring is replaced by aspects that register their own overlays.
The Fedora machine still doesn't have a NixOS layer, but it stops being structurally different from the machines that do.

### What This Costs

The pattern isn't without trade-offs.

It's relatively new and not particularly well documented.
The wiki I linked is the most thorough explanation I've found, but it's a thin slice of what you actually need to know to migrate a real configuration.
Most NixOS examples online use either the role-based approach I'm leaving behind or simpler ad-hoc structures, which means dendritic-specific guidance is harder to come by than for almost any other Nix pattern.
Two concrete gaps I ran into in the planning: the wiki says nothing about how to handle secrets management with sops-nix, and nothing about how to expose custom packages as both flake outputs and `pkgs.<name>` for in-aspect consumption.
Both turned out to be solved differently in every config I surveyed.
No canonical pattern has emerged.

There's more machinery between you and the underlying flake.
flake-parts is its own module system layered on top of the flake outputs, and `import-tree` is another layer that auto-imports files.
When something goes wrong the error has to bubble up through more abstraction before you see it, and stack traces tend to be longer and less direct.

The pattern also adds indirection in how aspects connect to each other.
Reading a host's import list still tells you exactly which aspects are active: that part is simpler.
But understanding _how_ two aspects are wired together involves more hops than before.
In the role-based setup, options live in one namespace: a single grep for `my.modules.foo` finds the declaration and every consumer at once, in plain file paths.
In dendritic, the producer is in one file (set via `flake.modules.nixos.foo`) and consumers reference it by registry name elsewhere (`inputs.self.modules.nixos.foo`), and cross-aspect concerns travel through interface aspects or factory parameters rather than direct option references.
Decoupling is the whole point (aspects can be moved and reused) but the trade-off is that following a single concern from declaration to use takes a registry lookup rather than a grep.

And the migration itself is substantial.
Every module has to be rewritten as an aspect, every host file has to be reorganised around explicit import lists, and the change touches essentially every file in the repository.

## The Challenges

Beyond the trade-offs above, the migration raises some design questions the documentation doesn't really cover.
These are the ones I had to work through before being confident about the plan.

### Multi-context Aspects and `home-manager.sharedModules`

The most elegant feature of dendritic is the multi-context aspect: a single file that configures both NixOS and home-manager for the same feature.
A `sway` aspect, for example, sets up the greeter and enables the NixOS sway module on one side, and configures the sway window manager in home-manager on the other.
The NixOS side wires in the home-manager side using `home-manager.sharedModules`:

```nix
{ inputs, ... }: {
  flake.modules.nixos.sway = {
    programs.sway.enable = true;
    services.greetd = { ... };
    home-manager.sharedModules = [
      inputs.self.modules.homeManager.sway
    ];
  };

  flake.modules.homeManager.sway = {
    wayland.windowManager.sway = { ... };
  };
}
```

The host imports only `inputs.self.modules.nixos.sway`.
The home-manager part is pulled in automatically.
This is genuinely elegant.

But this only works if `home-manager.nixosModules.home-manager` is already imported somewhere.
That's what declares `home-manager.sharedModules` as a valid NixOS option in the first place.
The right place to import it is in the user aspect, since the user aspect is what fundamentally enables home-manager for a user:

```nix
flake.modules.nixos.benedikt = { pkgs, ... }: {
  imports = [ inputs.home-manager.nixosModules.home-manager ];
  users.users.benedikt = { isNormalUser = true; shell = pkgs.fish; ... };
  home-manager.users.benedikt.imports = [
    inputs.self.modules.homeManager.benedikt
  ];
};
```

Any host that uses multi-context aspects must also import a user aspect.
Which is always true anyway: you need a user to have home-manager in the first place.

### Non-aspect Flake Outputs

NixOS and home-manager configurations aren't the only things my flake produces.
There are also custom packages I build (`gh-get`, `jfmt-java`, `kotlin-lsp`, `maven_4`), an overlay that exposes them, dev shells, treefmt-nix as a formatter, pre-commit hooks as checks, and a flake template for minimal dev shells.
None of these are aspects in the `flake.modules.<class>.<name>` sense, but they all need to keep working in the new structure.

For most of them, flake-parts handles things naturally.
Per-system outputs go into a `perSystem` block in a flake-parts module file, system-independent ones go into `flake.*`.
The formatter, checks, dev shell, overlays, and templates each become a small file under `modules/nix/` that the import-tree picks up automatically.

Custom packages are the interesting case.
I want each package to be both a flake output (so `nix build .#gh-get` works) _and_ available as `pkgs.gh-get` inside any aspect (so the standalone home-manager configuration doesn't need to wire them in manually, which is one of the things I want to fix).
The dendritic wiki has nothing concrete to say about this, and the configs I surveyed solve it four different ways.
The cleanest pattern I found, in [gigamonster256/nix-config](https://github.com/gigamonster256/nix-config/blob/5175006f466e9769f221ad617d8dbb84553b5997/pkgs/packages.nix), is a single helper module that declares a `packages` flake-parts option and derives both `perSystem.packages` and `flake.overlays.additions` from it:

```nix
# modules/nix/packages.nix
{ config, lib, ... }: {
  options.packages = lib.mkOption {
    type = lib.types.attrsOf (lib.types.functionTo lib.types.package);
    default = { };
  };

  config = {
    perSystem = { pkgs, ... }: {
      packages = builtins.intersectAttrs config.packages pkgs;
    };
    flake.overlays.additions = final: _prev:
      builtins.mapAttrs (_: pkg: final.callPackage pkg { }) config.packages;
  };
}
```

Each individual package is then a tiny flake-parts module that sets a single entry in that option:

```nix
# modules/packages/gh-get.nix
{
  packages.gh-get = { stdenv, fetchFromGitHub, ... }: stdenv.mkDerivation {
    # derivation goes here
  };
}
```

Adding a new package is dropping a new file.
The flake output and the overlay both pick it up automatically, no central list to maintain.
The manual overlay wiring that my standalone home-manager configuration currently needs (the inline anonymous module from earlier) goes away.
Overlays are registered as proper flake outputs and consumed by aspects through `inputs.self.overlays.*`.

### Factory Aspects for Parameterised Configuration

The dendritic pattern has no enable/disable options. You either import an aspect or you don't.
For aspects that need configuration parameters, the answer is a factory: a function registered in `flake.factory.*` that takes parameters and returns a module.

My Java setup is a good example.
It installs a primary JDK, exposes paths for additional versions as environment variables, configures Gradle, and sets up JDTLS.
The primary version differs between machines.
As a factory:

```nix
flake.factory.java = { version, additionalVersions ? [], linkToUserHome ? false }: {
  programs.java.package = pkgs."jdk${toString version}";
  programs.gradle = { ... };
  # ...
};
```

Called at the import site with the parameters for that specific context:

```nix
imports = [
  (inputs.self.factory.java { version = 21; additionalVersions = [ 8 11 17 25 ]; })
];
```

The "configuration" is explicit at the call site rather than hidden behind option assignments spread across files.

### Cross-cutting Concerns Between Aspects

One of the more interesting challenges came from a corner of my current configuration that I had been quietly uncomfortable with.
The home-manager Java module reaches into the nixvim namespace to wire up jdtls (the Java language server) with the list of installed JDK versions:

```nix
# in home/java/default.nix
programs.nixvim.plugins.jdtls.settings.settings.java.configuration.runtimes = lib.map (v: {
  name = if v == "8" then "JavaSE-1.8" else "JavaSE-${v}";
  path = javaHomeForVersion v;
}) allVersions;
```

The instinct was: if Java is enabled, jdtls should know about every Java version.
The implementation co-located this cross-config with the Java module rather than having the nvim module reach into Java's namespace.
That seemed cleaner at the time.

It works, but it hides a real dependency.
The Java module's output is only valid if nixvim happens to be imported on the same host.
If I ever wanted Java without nvim (on a build server, say) this configuration would error because `programs.nixvim.*` would be unknown options.
In my current setup the dependency is invisible because every machine that has Java also has nvim.
In dendritic, where each host's import list is meant to be self-contained and explicit, hidden dependencies like this become actively harmful.

The dendritic answer is to flip the dependency direction.
The Java aspect should know nothing about IDEs.
The nvim/java aspect should be the one that reacts to Java being present.
To bridge them I introduce a small interface aspect that declares an option both sides can talk through:

```nix
flake.modules.homeManager.javaInterface = {
  options.my.java.versions = lib.mkOption {
    type = lib.types.listOf lib.types.int;
    default = [];
  };
};

flake.factory.java = { version, additionalVersions ? [], ... }: {
  imports = [ inputs.self.modules.homeManager.javaInterface ];
  my.java.versions = additionalVersions ++ [ version ];
  # ... actual Java setup ...
};

flake.modules.homeManager.nvimJava = {
  imports = [ inputs.self.modules.homeManager.javaInterface ];
  programs.nixvim.plugins.jdtls.settings.settings.java.configuration.runtimes =
    lib.map (v: { name = "JavaSE-${toString v}"; path = ...; })
            config.my.java.versions;
};
```

Now the relationship is explicit and one-directional.
The nvim/java aspect reacts to Java being imported; Java doesn't know nvim exists.
If only Java is imported, nothing reads the option and nothing breaks.
If only nvim/java is imported, the option defaults to an empty list and jdtls just doesn't get multi-version awareness: a sensible degradation rather than a build error.
If neither is imported, the interface aspect isn't imported either and the option doesn't exist at all, which is also fine.

This is the dendritic version of "if Java is enabled, jdtls should know about it", except now "enabled" means "imported", and the relationship between the two aspects is something the module system will validate for me rather than something I have to remember.

Once I had this lens, the same shape jumped out elsewhere with a different fix.
My https-proxy module declares a `services.my-https-proxy.configurations` list option, and service modules (nextcloud, vaultwarden, calibre-web) append entries to it to register themselves with the reverse proxy.
This only works today because `modules/default.nix` imports every module unconditionally, so the https-proxy option is always declared by the time a service tries to add to it.
In dendritic the fix is for each service aspect to explicitly import the https-proxy aspect (`imports = [ inputs.self.modules.nixos.httpsProxy ];`), what the dendritic docs call an _inheritance aspect_.
The unspoken dependency becomes a line in the service's `imports` list.

So two patterns for cross-cutting concerns: an interface aspect both sides talk through, for "this aspect reacts to that aspect being present" (Java/jdtls); an inheritance aspect, for "this aspect can't function without that aspect" (services/httpsProxy).
What you don't do in dendritic is rely on a central file having imported everything for you.

### SOPS Secrets

My configuration uses [sops-nix](https://github.com/Mic92/sops-nix) for secrets.
Each host has its own `secrets.yaml` file, and a `.sops.yaml` at the repository root maps path regexes to the age keys allowed to decrypt them.
Service modules read values via `config.sops.secrets."<name>".path`.

The current `sops` module auto-loads the per-host secrets file by computing the path from custom options:

```nix
defaultSopsPath = "${toString inputs.self}/systems/${config.my.host.system}/${config.my.host.name}/secrets.yaml";
# ...
sops.defaultSopsFile = lib.mkIf (builtins.pathExists defaultSopsPath) defaultSopsPath;
```

I never wire up `sops.defaultSopsFile` per host: adding a `secrets.yaml` in the right location is enough.
Convenient, but `my.host.system` and `my.host.name` are options defined in my central `options` module, and that whole module disappears in dendritic.

So I went looking for how other dendritic configs handle this, and found out there is no canonical answer.
None of the reference dendritic configs (vic/vix, drupol/infra, mightyiam/infra, Doc-Steve's own) use sops at all.
The configs that do combine the two solve it in at least four different ways.
[Bad3r/nixos](https://github.com/Bad3r/nixos/tree/15acff159d37dc195e4f8f8db1dad3c05769212c) skips `defaultSopsFile` entirely and sets `sopsFile` per-secret, with a `.sops.yaml` generated from a Nix module.
[fbosch/nixos](https://github.com/fbosch/nixos/tree/ecadc7abe816ff878500760550475f410a5f6de3) splits secrets by purpose rather than host (`common.yaml`, `apis.yaml`, `containers.yaml`) and uses helper functions for boilerplate.
[ryanwalder/nixos-config](https://github.com/ryanwalder/nixos-config/tree/a752ca5caf7d0785aa7422da76b5bf9ca3190dc7) auto-derives the path from `config.networking.hostName` in a shared base module, closest to my current setup.
[raphaelweis/config](https://github.com/raphaelweis/config/tree/3e81712cde5d596c63a6ca454e81f97d1d7ac687) sets `sops.defaultSopsFile` explicitly in each host's module via a `let hostname = "..."` binding.
Different configs, different answers.

The auto-derive approach is tempting because it preserves my current zero-wiring behaviour, but it pushes back against the dendritic principle that imports should tell the whole story.
A host file that imports `sops` and silently picks up a file named after its hostname is doing implicit work that the import list doesn't advertise.
So I looked at the explicit per-host approach instead, and noticed something.
Sops has the same shape as Java: a mandatory parameter (the secrets file path) that varies per host and has no sensible default.
Java is a factory in my plan for exactly that reason.
Treating sops as a factory too gives me one consistent rule across the configuration: parameters that must be provided per host go through a factory; defaults that hosts can optionally override stay as a simple aspect.

```nix
# modules/nixos/sops.nix
{ inputs, ... }: {
  flake.factory.sops = { secretsFile }: {
    imports = [ inputs.sops-nix.nixosModules.sops ];
    sops.age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
    sops.defaultSopsFile = secretsFile;
  };
}
```

Each host calls the factory at the import site:

```nix
# modules/hosts/srv-prod-2/default.nix
flake.modules.nixos.srv-prod-2 = {
  imports = [
    (inputs.self.factory.sops { secretsFile = ./secrets.yaml; })
    inputs.self.modules.nixos.nextcloud
    inputs.self.modules.nixos.vaultwarden
  ];
  networking.hostName = "srv-prod-2";
};
```

The factory's signature documents the requirement at the import site: you can't import sops without thinking about which file.
The `secrets.yaml` itself sits next to the host's `default.nix` in `modules/hosts/<host>/`.
It isn't a `.nix` file, so `import-tree` ignores it; everything for the host stays in one directory.

The fragile part is the move itself.
As `secrets.yaml` files relocate, `.sops.yaml` rules need updating, and `sops updatekeys` has to run on each file so the age keys listed in the new rule actually own the file's data key.
This has to happen per host as part of that host's migration commit, not as a single rename across the repository.[^2]

[^2]:
    While working through all of this, a different idea kept nagging at me: maybe a single per-host `secrets.yaml` is the wrong unit altogether.
    Today, composing a new host from existing modules means rebuilding multiple times to discover, error by error, which secrets keys each module expects to find in `secrets.yaml`.
    A more dendritic answer would be to make every service module that needs secrets a factory taking its own `secretsFile` parameter, so the requirement is part of the module's signature, and a host composing a service aspect can't forget the secrets file.
    That's a bigger redesign than I want to take on as part of this migration, but the factory-shaped sops aspect is at least pointing in that direction.

### Deliberate Duplication for Disko

I tried to generalise my disko disk-layout configuration into a single configurable module but found it made things hard to maintain and dangerous to change.
A wrong edit to a shared disko config could result in disks being mounted incorrectly at activation time.
I now colocate the disko config for each machine alongside that machine's configuration.

In the dendritic migration I'm continuing this approach but as named variant aspects (`diskoBtrfsLuks`, `diskoExtMbr`) rather than a configurable generic.
Machines that happen to use the same layout share an aspect.
Machines with unique layouts get their own dedicated aspect.
No factory, no options, just named variants.
The import list on each host makes it immediately obvious which disk layout it uses, and changing one machine's layout can't accidentally break another.

Hardware-specific files that genuinely belong to one machine, like a `nixos-generate-config` output, live outside `modules/` in a separate `machines/` directory and are imported by path from the host aspect.[^3]
The `machines/` directory is a transitional measure: every file in it could be wrapped as a flake-parts module and moved under `modules/`, which is what I plan to do for the named disko variants above and for the only host that still has a generated hardware configuration.

[^3]: `import-tree` recursively imports every `.nix` file under `modules/` as a flake-parts module, so plain NixOS modules can't live there or they'd cause evaluation errors.

## What's Next

The plan is a gradual migration via a `_needs_migration/` holding area.
The existing `modules/` and `home/` directories move there intact.
New aspects are created in a fresh `modules/` structure one at a time, and path-based imports in `_needs_migration/home/default.nix` are replaced with registry references as each aspect is migrated.
When that file has no path imports left, it's ready to become `flake.modules.homeManager.benedikt`, the home-manager side of my user aspect.

Once the migration is done, adding the NixOS work laptop should be straightforward: create `modules/hosts/work-laptop/`, write a `kolide` aspect and a `falcon-sensor` aspect (adapting [wimpysworld's approach](https://github.com/wimpysworld/nix-config/tree/11a406c5f0a036bf0cc2cf543a530ee7c06f8d74/nixos/_mixins/policy)), and compose them into a host that looks like any other.

I'll write a follow-up post once the migration is complete.
