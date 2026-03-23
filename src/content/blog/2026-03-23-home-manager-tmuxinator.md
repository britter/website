---
title: "Declarative tmuxinator Projects with Home Manager"
description: "How I wrote a custom Home Manager module to manage tmuxinator projects declaratively - and why I've decided to contribute it upstream."
pubDate: "2026-03-23"
image: "home-manager-tmuxinator.png"
---

tmux is one of the most foundational tools in my workflow - so much so that it made the list in my [Advent of Donations](/blog/2025/12/01/advent-of-donations/) post last year.
Whatever I'm working on, it starts with opening a tmux session.

For the uninitiated: [tmux](https://github.com/tmux/tmux) is a terminal multiplexer.
It lets you run multiple terminal sessions inside a single window, split panes, and switch between them using keyboard shortcuts.

## tmuxinator

[tmuxinator](https://github.com/tmuxinator/tmuxinator) builds on top of tmux by letting you define project layouts in YAML files.
Each project specifies a root directory, which windows to create, how to split them into panes, and which commands to run in each.
Project files live in `~/.config/tmuxinator/` and are named after the project.

A typical project file looks like this:

```yaml
name: myproject
root: ~/code/myproject
windows:
  - editor:
      layout: main-vertical
      panes:
        - vim .
        - guard
  - server: bundle exec rails s
  - logs: tail -f log/development.log
```

Running `tmuxinator start myproject` spins up the entire session for you - editor open, server running, log tail in the background, all in one command.

## Writing a Home Manager Module for tmuxinator

I manage my entire home environment declaratively using [Home Manager](https://github.com/nix-community/home-manager).
Shell config, editor config, git config - all of it lives in [Nix files under version control](https://github.com/britter/nix-configuration).
Home Manager already has a `programs.tmux` module that covers tmux settings and even has a `programs.tmux.tmuxinator.enable` option that installs the tmuxinator gem.
But that's where it stops.
The actual project YAML files are left for you to manage yourself - outside of Home Manager, outside of version control, outside of the declarative world.

Fortunately it's not hard to fill that gap.
The Home Manager module system makes it straightforward to extend existing modules with new options.
I've written about the [NixOS module system](/blog/2025/01/09/nixos-modules/) before - most of it applies to Home Manager as well.

Two problems to solve: the project files need to be serialized to YAML, and their structure is arbitrary - different projects will have different windows, panes, and hooks, so it's impractical to model every possible option explicitly.
Both are solved by combining `pkgs.formats.yaml` with a `freeformType`.
`pkgs.formats.yaml` takes a Nix value and produces a YAML file as a store path.
`freeformType` means any attribute set on a project is accepted as-is and serialized - the only thing we explicitly declare is `name`, so it defaults to the attribute name in the `projects` attrset and you don't have to repeat yourself.
As a side note, `pkgs.formats` provides multiple formats that can be used this way - including JSON, INI, and Java properties files.

The solution to both problems is `freeformType = yamlFormat.type`.
`pkgs.formats.yaml` takes a Nix value and produces a YAML file as a store path.
Setting it as the `freeformType` of the submodule means any attribute set on a project is accepted as-is and serialized - the only thing we explicitly declare is `name`, so it defaults to the attribute name in the `projects` attrset and you don't have to repeat yourself.
As a side note, `pkgs.formats` provides multiple formats that can be used this way - including JSON, INI, and Java properties files.

```nix
  yamlFormat = pkgs.formats.yaml { };

  projectsType = lib.types.submodule (
    { name, ... }:
    {
      freeformType = yamlFormat.type;
      options = {
        name = lib.mkOption {
          type = lib.types.str;
          default = name;
          description = "The project name, used as the YAML file name.";
        };
      };
    }
  );
```

The next challenge is writing out individual files from the projects attrset.
`xdg.configFile` expects an attrset where each key is a file path and each value is a file specification.
`lib.mapAttrs'` transforms one attrset into another - the apostrophe variant allows renaming the keys, which is exactly what we need here to turn project names into file paths.
The first argument to the mapping function is the original key, which we name `_k` to signal that it's intentionally unused - we get the name from `v.name` instead, which defaults to the attrset key anyway.
[Noogle](https://noogle.dev) is an excellent resource for discovering functions like this across the Nix and nixpkgs standard libraries.

```nix
  xdg.configFile = lib.mapAttrs' (
    _k: v:
    lib.nameValuePair "tmuxinator/${v.name}.yaml" {
      source = yamlFormat.generate "${v.name}.yaml" v;
    }
  ) cfg.tmuxinator.projects;
```

With the module in place, tmuxinator projects become part of the Home Manager configuration like everything else:

```nix
programs.tmux.tmuxinator = {
  enable = true;
  projects = {
    website = {
      root = "~/code/website";
      windows = [
        { editor = { panes = [ "vim ." "just dev" ]; }; }
      ];
    };
  };
};
```

## Conclusion

I've been running this module in my personal Nix configuration for over a year.
At some point it started to feel odd keeping it to myself - Home Manager already has the plumbing for tmuxinator, and this is the natural completion of that.
So I cleaned it up, added a configurable `package` option, wrote tests, and opened a pull request: [nix-community/home-manager#8954](https://github.com/nix-community/home-manager/pull/8954).

If you need help with NixOS or want to optimize your setup, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch with me!
