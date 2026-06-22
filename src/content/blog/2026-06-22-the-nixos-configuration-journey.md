---
title: "The NixOS Configuration Journey"
description: "How my NixOS configuration grew from a single configuration.nix into a multi-machine flake - one tool at a time, and why I adopted each one when I did."
topics: ["NixOS", "Nix"]
---

The [Nix](https://nixos.org) ecosystem has a discoverability problem.
Open any "my NixOS setup" repository on GitHub and you're greeted with flakes, disko, home-manager, nixos-anywhere, sops-nix, and a dozen other tools wired together in ways that assume you already know why each one is there.
For someone who just installed NixOS and is staring at `/etc/nixos/configuration.nix`, that's overwhelming.

What nobody tells you is that none of those people adopted all of that at once.
I certainly didn't.
My [NixOS configuration](https://github.com/britter/nix-configuration) has grown over more than two years, and every tool in it was added at the moment a specific pain became annoying enough to fix.

This post is a tour of that journey.
For each tool I'll explain what problem it solved, why I reached for it, and what's great about it.
I've ordered them by the concern they address - system configuration first, then the user environment - which isn't strictly the order I adopted them in.[^1]
The goal is to show that you can start small and grow your setup one tool at a time, instead of swallowing the whole ecosystem on day one.

[^1]: home-manager is the clearest example: it's actually where my journey began, well before flakes. But it sits more naturally once the system layer is in place, so that's where I've put it.

## It Starts With configuration.nix

Every NixOS install hands you the same starting point: a single file at `/etc/nixos/configuration.nix`.
You run `nixos-rebuild switch`, NixOS reads that file, and your system becomes whatever the file describes.
Want a package? Add it to `environment.systemPackages`.
Want SSH? Set `services.openssh.enable = true`.
Rebuild, and it's there.

This is a genuinely great place to start, and I think people are too quick to tell newcomers to skip it.
The whole declarative model of NixOS - your system is a function of a configuration file - is right there in its simplest form, with nothing else in the way.
My configuration began exactly like this: one file, 158 lines, describing a single laptop.

This works well for a while, but a few limitations start to show.
The file lives at `/etc/nixos/`, outside any version control, so there's no history and nothing to back up.
And the moment you own a second machine, you start copy-pasting between two files that slowly diverge.

The more fundamental problem is easy to miss at first.
Your `configuration.nix` describes _what_ you want installed, but it never says _which_ version of nixpkgs those packages come from.
That part - the exact revision of the package set - comes from a channel, which is mutable state you set imperatively with `nix-channel` and update whenever you run `nix-channel --update`.
So the configuration is declarative, but it isn't self-contained.
Hand the same file to someone else, or to yourself on a fresh machine, and it can build a different system - or not build at all - because their channel points at a different snapshot of nixpkgs than yours.
Everything is declarative, and yet I can't reliably build your `configuration.nix` on my machine.

This gets worse as soon as you reach for anything outside nixpkgs.
Say you want [home-manager](https://github.com/nix-community/home-manager) to manage your dotfiles, or a package from the [Nix User Repository](https://github.com/nix-community/NUR) that isn't in nixpkgs.
Each of those is another channel, and each one has to stay compatible with the nixpkgs channel it runs against.
Now you're keeping several moving snapshots in sync by hand, with nothing recording which combination actually worked.

## Flakes and Git

Flakes close that gap.
Turning the configuration into a [flake](https://nixos.wiki/wiki/Flakes) makes it name every one of its inputs explicitly - nixpkgs, home-manager, the NUR, and eventually all the other tools in this post - and pins each one to an exact revision in a `flake.lock` file.
The thing the channel left implicit is now written down and committed alongside the configuration.

That lock file is what finally makes the configuration self-contained and reproducible.
Rebuild from the same flake on another machine, or in six months, and you get the same system, because the exact same revisions of every input come along with it.
The third-party sources stop being a juggling act: they're locked together, updated together when _I_ decide to, and recorded as a combination that's known to work.

Putting the flake in a git repository is what unlocks everything else.
Suddenly the configuration has a history and lives somewhere other than the machine it configures.

It also changes how I handle multiple machines.
With `configuration.nix`, each host is its own standalone file, typically sitting on the machine it configures and unrelated to any other - sharing something between two machines means copying it and keeping the copies in sync by hand.
A single `flake.nix` describes _all_ of my hosts at once, so the configuration they have in common is written once and imported by each of them instead of duplicated per machine.

A flake also holds far more than host configurations.
The same `flake.nix` can define my own package derivations and expose a devShell preloaded with the tools I need when working on the configuration.
It can also declare checks that verify the whole thing still evaluates and builds, and those checks run in CI on every change.
At that point the configuration stops being a pile of dotfiles and becomes a proper software project - one where I can apply the same techniques I use everywhere else in software engineering: code reuse, automated testing, and continuous integration.

This is the step where my configuration stopped being "my laptop's config file" and became something I genuinely maintain.
If you adopt one thing from this post, adopt this one.

## disko: Declarative Disk Layout

By now almost everything about a machine is declarative - except the very first step of getting NixOS onto it.
When you install NixOS, you set up the disk yourself.
Most people do this by clicking through the graphical [Calamares](https://calamares.io) installer on the official ISO; more experienced users skip Calamares and partition by hand with `parted` and `cryptsetup`.
You lay out the partitions, configure LUKS encryption, create the filesystems, and mount everything.
Then [`nixos-generate-config`](https://github.com/NixOS/nixpkgs/blob/44cdcdf7aa52a4a71eaaae0bc215a71a4f297e18/nixos/modules/installer/tools/nixos-generate-config.pl), the installer's hardware-detection script, writes a `hardware-configuration.nix` that, as far as the disks are concerned, just records the result: here are the filesystems and mount points that happen to exist.
The layout isn't something the configuration declares and creates - the configuration only describes, after the fact, what you already did by hand.

[disko](https://github.com/nix-community/disko) turns that around.
You describe the partitions, filesystems, and encryption declaratively, and disko does the partitioning, formatting, and mounting for you.
Here's a trimmed version of the layout for my laptop - a GPT disk with an EFI partition and a LUKS-encrypted root:

```nix
disko.devices = {
  disk.main = {
    device = "/dev/nvme0n1";
    type = "disk";
    content = {
      type = "gpt";
      partitions = {
        ESP = {
          size = "512M";
          type = "EF00";
          content = {
            type = "filesystem";
            format = "vfat";
            mountpoint = "/boot";
          };
        };
        luks = {
          size = "100%";
          content = {
            type = "luks";
            name = "crypted";
            # ...
          };
        };
      };
    };
  };
};
```

I adopted disko on my laptop first, partly because I wanted to move to a [btrfs](https://btrfs.readthedocs.io) layout that would let me experiment with [impermanence](https://github.com/nix-community/impermanence) later on.
In the spirit of honesty: I never actually got around to the impermanence part.
But disko earned its place regardless: the disk layout now lives in the flake like everything else, instead of being a manual step I have to remember and reproduce by hand.

## nixos-facter: Hardware as Data

disko covers the disk half of that generated `hardware-configuration.nix`.
The other half is hardware detection.
`nixos-generate-config` is historically a [Perl](https://www.perl.org/) program full of hardware-detection heuristics: it probes the machine and writes out the kernel modules, firmware, and CPU microcode settings it thinks you need.
The catch is that you only ever get the result.
The script looks at a great deal of information about your hardware and hands you a generated Nix file; the underlying data it processed is gone.
If you later want to base a decision on some hardware detail, it isn't there to inspect - you have whatever `nixos-generate-config` chose to encode, and nothing more.

[nixos-facter](https://github.com/nix-community/nixos-facter) inverts that.
Instead of generating Nix code once, it produces a machine-readable report of the hardware - a `facter.json` file - that you commit to the repository.
The NixOS modules then evaluate against that report at build time and derive the kernel modules and settings from it.
The hardware description stops being generated code you can't see behind and becomes data your configuration can actually reason about.

```nix
hardware.facter.reportPath = ./facter.json;
```

nixos-facter started life as a separate project before being upstreamed, so today the `hardware.facter` options come straight from nixpkgs - there's no extra flake input to wire up.
Committing a report instead of generating config on the machine also turns out to matter a lot once installs are automated.

## nixos-hardware: Machine-Specific Tuning

facter records what's physically in a machine, but some hardware needs more than detection: firmware quirks, power-management defaults, GPU specifics that are particular to a given laptop model.
Working those out per model is tedious, and most of it has already been solved by someone else.

[nixos-hardware](https://github.com/NixOS/nixos-hardware) is a community repository of NixOS modules for specific hardware.
You add it as a flake input and import the module for your machine.
On my [Framework 13](https://frame.work) it sits right next to the facter report from the previous section:

```nix
{ inputs, ... }:
{
  imports = [ inputs.nixos-hardware.nixosModules.framework-amd-ai-300-series ];

  hardware.facter.reportPath = ./facter.json;
}
```

That one import pulls in the maintained, model-specific defaults so I don't have to rediscover them myself.
Between disko, facter, and nixos-hardware, the whole machine - its disks, its hardware, and its model-specific tuning - is now described in the flake.
Nothing about bringing up a fresh machine requires me to sit in front of it anymore.

## nixos-anywhere: Automated Server Installs

That last point is what makes fully automated installs possible, and servers are where it paid off.
Once I was running more than one - a few home servers and an offsite box - installing each by hand was the bottleneck.
And automation isn't always just a convenience: rent a VPS and there is no physical machine you could walk up to, plug a USB stick into, and boot an installer on - whatever brings it up has to do so remotely.

[nixos-anywhere](https://github.com/nix-community/nixos-anywhere) removes the manual install entirely.
It can turn _any_ machine you can reach over SSH into a NixOS host, whatever Linux distribution it happens to run right now - which is exactly what makes it possible to put NixOS on a VPS that boots into someone else's default image.
Point it at the target and it partitions the disk (using your disko config), installs NixOS from your flake, and reboots into it.
A fresh machine goes from "blank" to "running my configuration" in a single command.[^2]

One detail matters more than the rest: nixos-anywhere can copy files onto the target during the install, and I use that to provision each server's SSH host key.
That closes a bootstrap loop, because that same key is what lets the machine decrypt its secrets on first boot - which is the next tool.

[^2]: I wrap the invocation in a small helper in my flake's dev shell so I don't have to remember all the flags. That's a detail of my own repository rather than something you need, so I'll spare you the script.

## sops-nix: Secrets in the Repository

Putting the configuration in git was a huge win, but it came with an obvious limit: you can't commit secrets.
Servers need them constantly - database passwords, API tokens, backup repository keys - and none of that can sit in a repository in plaintext.
For a while that meant secrets lived outside the declarative world, copied onto machines by hand, which is exactly the kind of manual step the rest of this journey has been about eliminating.

[sops-nix](https://github.com/Mic92/sops-nix) lets you commit secrets anyway - encrypted.
You keep an encrypted `secrets.yaml` next to each host in the repository, and sops-nix decrypts it at activation time using a key the machine already has: its SSH host key.
A `.sops.yaml` file declares which keys may read what, so each host can only decrypt the secrets that were encrypted for it.

This is where the nixos-anywhere host-key trick pays off.
Because the host key is provisioned during the install, a freshly deployed server can decrypt its own secrets the first time it boots - no manual key shuffling, no chicken-and-egg.
From there the decrypted values flow straight into services, the way I describe for the repository passwords and object-storage credentials behind my [home lab backups](/blog/2026/04/10/home-lab-backup-with-restic/).

With sops-nix, the last thing that lived outside version control finally moved into it.

## home-manager: The User Environment

Everything so far has been about the system.
But a system you log into is only half of it - the other half is the user environment: your shell, your editor config, your git settings, your dotfiles.

[home-manager](https://github.com/nix-community/home-manager) brings the declarative NixOS approach to that user-level configuration.
The same idea - describe the desired state in Nix, then realize it - applied to your home directory instead of the whole system.
Your `~/.gitconfig`, your shell aliases, your terminal multiplexer setup: all generated from Nix and kept under version control.

home-manager is actually what pulled me into Nix in the first place.
For years I kept a [dotfiles repository](https://github.com/britter/dotfiles) that I'd crafted over time - configuration for all the various programs I used, version-controlled and ready to drop onto a new machine.
It worked well for the configuration, but it had one blind spot: it couldn't install or remove the programs themselves.
Setting up a new machine, I had to remember which tools to install before any of that config was useful.
I tried keeping a script that listed every program I installed, but that only solved half the problem.
Removing a program was still a manual step, and I had to remember to delete it from the script too - which, of course, I didn't always do.
home-manager closes that gap: a program and its configuration are declared in the same place, installed and removed together.
It solved exactly the problem I had, and it started my NixOS journey.
I never looked back.

This is also the tool that follows you off NixOS.
home-manager runs standalone on any Linux distribution or macOS, which is how I manage the user environment on a work laptop that doesn't run NixOS.
It's the bridge that lets the same declarative dotfiles work everywhere I do.

Once your home is declarative, you start finding gaps you want to fill - I wrote about [building a custom home-manager module for tmuxinator](/blog/2026/03/23/home-manager-tmuxinator/) when I hit one.

## nixvim: Taming a Complex Neovim Setup

home-manager can drop an `init.lua` into place, but a serious [Neovim](https://neovim.io) setup is a small ecosystem of its own: a plugin manager, dozens of plugins, language servers, formatters, and a pile of Lua tying it all together.
The way that ecosystem is usually managed is the part that grates.
You open the editor and a plugin like [Mason](https://github.com/mason-org/mason.nvim) installs the language servers and tools for you, interactively, into your home directory.
It's convenient, but it's exactly the imperative, build-it-up-by-hand approach the rest of this journey has been moving away from - state you accumulate inside the editor by clicking around, rather than something declared in a file and reproducible on the next machine.

[nixvim](https://github.com/nix-community/nixvim) brings Neovim into the same declarative model as everything else.
It's a layer on top of home-manager that exposes the entire configuration - plugins, options, keybindings, language servers - as typed Nix options, with the plugins and servers coming from nixpkgs rather than a package manager living inside the editor.
The editor stops being an imperative island and becomes just another declarative module: the whole thing is described in one place and comes up identically on every machine.
For a setup as involved as an IDE-grade Neovim, that's worth a lot.

This is the tool I've written about most, because it's where a lot of my day-to-day friction lives: getting the [Kotlin LSP working under nixvim](/blog/2025/11/15/kotlin-lsp-nixvim/), and later wiring up [a Java formatter as a nixvim plugin](/blog/2026/05/06/jfmt-nixvim/).

## flake-parts: Organizing a Configuration That Grew

For most of this journey my configuration used a structure I adopted early on, while I was still learning Nix: every feature was a NixOS module with its own `enable` option, switched on per host through a central dispatcher.
It was, in effect, another module system layered on top of the one NixOS already gives you.
Adding a feature meant writing the module _and_ remembering to enable it somewhere, and working out what was actually active on a machine meant tracing `enable` flags across several files.
It worked for years, but the bookkeeping grew with every module.

What finally pushed me to change was home-manager.
A single feature often spans both the system and the user environment.
Take [swaylock](https://github.com/swaywm/swaylock), the screen locker: home-manager configures the program itself, but it can't unlock the screen until NixOS grants it a PAM rule.
In the old structure those two halves lived in separate places - a home-manager module here, a NixOS module there - wired together by hand, even though they describe one feature.

[flake-parts](https://flake.parts/) is what let me bring them back together.
It applies the same module system NixOS uses to the flake's outputs, so each feature becomes a self-contained module registered by name.
Crucially, one module can configure _both_ sides of a feature at once: a single swaylock file sets up its home-manager configuration and the NixOS PAM rule together, and any host that imports it gets the whole thing.
The split disappears.

It also dissolves the bookkeeping.
There are no `enable` options and no central dispatcher anymore - a host imports exactly the aspects it wants, by name, and that import list is the entire story of what the machine is.
This way of organising a flake has a name, the [dendritic pattern](/blog/2026/05/11/exploring-the-dendritic-nix-pattern/), and I wrote a whole post on what it is, why I wanted it, and the pitfalls I hit before migrating.
I've just finished that migration, and I'm happy with the shape the configuration has now.

## The Point

If you read my configuration today, you'll see all of this at once: flakes, disko, nixos-facter, nixos-hardware, nixos-anywhere, sops-nix, home-manager, nixvim, flake-parts.
It looks like a lot, and it is.
But I didn't sit down one weekend and assemble it.
Each piece arrived when a real problem made it worth the added complexity, and not a moment sooner.

That's the part I want newcomers to take away.
You don't need to understand the whole Nix ecosystem to get value out of NixOS.
Start with a single `configuration.nix`.
Move it into a flake and a git repository when channel drift or a second machine starts to hurt.
Reach for each tool when - and only when - you feel the pain it solves.
The ecosystem is large, but you get to adopt it one good decision at a time.

When you _are_ ready for the next tool, it's worth knowing where to look.
A lot of what's in this post comes from [nix-community](https://github.com/nix-community), a GitHub organization that hosts much of the surrounding ecosystem - home-manager, nixvim, nixos-anywhere, nixos-facter, NUR, and plenty more - all maintained by the same loose community.
For a broader survey, [awesome-nix](https://github.com/nix-community/awesome-nix) is a curated list of Nix-related projects, from tooling to learning resources.
Both are good places to discover the next thing whenever a new pain point shows up - and there will always be one.
The journey continues.

If you need help with NixOS or want to optimize your setup, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch with me!
