---
title: "Verified Agent Skills Managed by Nix"
description: "My AI agents' skills live in my Nix configuration. I introduced writeSkill, a helper that packages them the way nixpkgs writers package scripts, with two build-time checks. Invalid skills fail the build instead of failing my agents."
topics: ["Nix", "Home Manager", "AI"]
---

I manage my home environment using
[home-manager](https://github.com/nix-community/home-manager). Since AI agent
skills reside in the user home, I naturally started putting mine into my [Nix
configuration](https://github.com/britter/nix-configuration/tree/48c9e39aa7bcf6f8bd950a0c9330628afdd294be)
repository. When I added the asd-ste100 skill, it shipped with a linter for
Simplified Technical English. That made me wonder what other checks people run
on their skills, so I asked one of my agents. In this blog post I'm going to
show my `writeSkill` helper function, which runs these checks as part of the
build and behaves like other writer functions from `pkgs.writers`.

## The writers pattern

nixpkgs ships the
[writers](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/writers/scripts.nix):
`writePython3` runs flake8 on the script it packages, `writeLua` runs luacheck,
`writeShellApplication` runs shellcheck. I like where these checks live: they
are part of building the artifact. A broken script fails the build, so a broken
script is never produced. There is no lint step to remember and nothing to wire
up separately. Since I tend to have agents edit my skill files, I want this
safety net for them as well.

## `writeSkill`

I applied the same pattern to my skills. The `writeSkill` function turns a
skill directory into a store path and runs two checks along the way:

```nix
pkgs.writeSkill "calculations" { } ./skills/math/calculations
```

The first check is `skills-ref validate`, the reference validator from the
[Agent Skills repository](https://github.com/agentskills/agentskills), which I
package as
[`skills-ref`](https://github.com/britter/nix-configuration/blob/48c9e39aa7bcf6f8bd950a0c9330628afdd294be/packages/skills-ref/default.nix).
It checks the frontmatter against the spec: required
fields, the name rules, and the directory match. The validator compares the
directory basename to the frontmatter name, and store paths carry a hash
prefix. So the build first copies the source to a clean-named `work/<name>`
directory.

The second check is `ste-lint`, the Simplified Technical English linter from
the [asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) project,
which I package as a standalone
[`ste-lint`](https://github.com/britter/nix-configuration/blob/48c9e39aa7bcf6f8bd950a0c9330628afdd294be/packages/ste-lint/default.nix)
command. It fails the build on hard violations
of the STE rules, while advisory findings such as passive voice don't. Skills
whose body I don't maintain pass `{ lint = false; }`: the spec check still
runs, the prose check doesn't.

This is the whole function, from
[`packages/write-skill/default.nix`](https://github.com/britter/nix-configuration/blob/48c9e39aa7bcf6f8bd950a0c9330628afdd294be/packages/write-skill/default.nix):

```nix
{
  lib,
  runCommand,
  skills-ref,
  ste-lint,
}:
name:
{
  lint ? true,
}:
src:
runCommand name
  {
    nativeBuildInputs = [ skills-ref ] ++ lib.optionals lint [ ste-lint ];
  }
  (
    # skills-ref checks the directory basename against the frontmatter name,
    # and store paths carry a hash prefix, so validate a clean-named copy.
    # This is also the layout the harnesses install.
    ''
      mkdir work
      cp -r "${src}" "work/${name}"
      chmod -R u+w "work/${name}"
      skills-ref validate "work/${name}"
    ''
    + lib.optionalString lint ''
      # Prose check: SKILL.md must pass the STE linter with zero hard
      # violations; advisory findings (passive voice, compound tenses) do not
      # fail the build.
      ste-lint "work/${name}/SKILL.md"
    ''
    + ''
      cp -r "work/${name}" "$out"
    ''
  )
```

The checks also pay off when the author is an agent. The context files tell my
agents to add and edit skills in the config repository. An agent that writes an
invalid skill sees the build failure, reads the validator's complaint, and
fixes it before anything ships.

## Why not a flake check?

The obvious alternative is a `checks` attribute in the flake. I didn't want the
plumbing. The check needs writing, and it has to stay in sync with how the skills
build and install.

With the writer, checking is a property of the artifact. Building my
home-manager generation builds every enabled skill as a dependency, so an
invalid skill fails the switch with the validator's output in the log. The
feedback lands where I make the change, and Nix caches it like everything else.

`writeSkill` is forty lines, most of them comments. It works because the checks
run where the artifact is built. Only verified skills exist, and neither my
agents nor I can deploy a broken one.
