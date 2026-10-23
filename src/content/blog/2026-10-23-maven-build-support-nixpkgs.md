---
title: "Improving Maven Build Support in nixpkgs"
description: "How maven.buildMavenPackage works in nixpkgs, and a tour through its recent improvements: readable FOD logs, fixed-point evaluation with finalAttrs and finalPackage, and a maven_4 hook."
topics: ["Nix", "Maven", "nixpkgs", "Java"]
---

Over the past year I've been working on the Maven build support in
[nixpkgs](https://github.com/NixOS/nixpkgs). Most of that work happened in
small PRs that flew under the radar, today I'd like to take some time to
explain how `maven.buildMavenPackage` works and the improvements I made to it
along the way.

## How `maven.buildMavenPackage` works

Most Java packages in nixpkgs that use Maven go through
`maven.buildMavenPackage`. Maven's dependency resolution is a side effect of the
build, which doesn't fit Nix's sandbox model, so the dependencies get resolved
once into a fixed-output derivation (`fetchedMavenDeps`) and keyed by a hash the
caller provides as `mvnHash`. The actual package build then runs offline against
that cached repository. This is how build support for several other languages such
as Go and Rust also works.

Under the hood, `buildMavenPackage` is a (complicated) wrapper around
`stdenv.mkDerivation`. Unfortunately, when I first looked into it the wrapper
didn't follow the conventions that `mkDerivation` established, in particular
`finalAttrs` and `finalPackage`. So I decided to add support for both.

## Fixed-point evaluation: `finalAttrs` and `finalPackage`

The change I care about most is
[#513696](https://github.com/NixOS/nixpkgs/pull/513696) with its follow-up
[#516099](https://github.com/NixOS/nixpkgs/pull/516099): `buildMavenPackage`
now accepts a function that receives `finalAttrs`, just like
`stdenv.mkDerivation (finalAttrs: ...)` does. The pattern takes some time to
wrap your head around. It's about building a value by calling a function with
its own result, and is one of the classic design patterns in nixpkgs. [Nix
pills](https://nixos.org/guides/nix-pills/17-nixpkgs-overriding-packages.html#fixed-point)
have a good chapter on how `fix` lets a set refer to itself without `rec`.

Before, referring to the attributes of the package you're currently defining
required a recursive attrset:

```nix
maven.buildMavenPackage rec {
  pname = "foo";
  version = "1.0";

  src = fetchFromGitHub {
    owner = "jane-doe";
    repo = "some-repo";
    tag = "v${version}";
    hash = "sha256-...";
  };
}
```

`rec` works, but it's a discouraged pattern in nixpkgs. The discussion in
["Avoid rec expressions in nixpkgs"](https://discourse.nixos.org/t/avoid-rec-expresions-in-nixpkgs/8293)
sums up the reasons: shadowing an attribute can trigger an infinite recursion
error that is hard to debug (`rec { b = b; }` is the smallest example), and
references through a `rec` attrset don't survive overriding with `overrideAttrs`
the way you'd expect. That's why `mkDerivation` settled on the `finalAttrs`
parameter as the recommended alternative, and packages in nixpkgs are expected
to use it. Since `buildMavenPackage` wraps `mkDerivation`, it made sense for the
wrapper to support the same style. Now you can write the same thing the stdenv
way:

```nix
maven.buildMavenPackage (finalAttrs: {
  pname = "foo";
  version = "1.0";

  src = fetchFromGitHub {
    owner = "jane-doe";
    repo = "some-repo";
    tag = "v${finalAttrs.version}";
    hash = "sha256-...";
  };
})
```

The follow-up PR adds a second attribute to the fixed point: `finalPackage`,
which hands you the fully constructed package from inside the function. The
typical use is `passthru` tests, where you need the package itself rather than
any of its input attributes:

```nix
maven.buildMavenPackage (finalAttrs: {
  # ...

  passthru.tests.version = testVersion {
    package = finalAttrs.finalPackage;
    command = "checkstyle --version";
  };
})
```

I've already migrated some real packages to this style.
[checkstyle](https://github.com/NixOS/nixpkgs/blob/master/pkgs/by-name/ch/checkstyle/package.nix),
for example, now uses `finalAttrs` throughout its package definition, including
the source tag and the changelog URL in its meta.

If you maintain a package that still uses `rec` with `buildMavenPackage`, the
migration is mechanical: change `rec {` to `(finalAttrs: {`, close the extra
paren, and replace references to the attrset's own attributes with
`finalAttrs.<name>`.

## `maven_4`

Maven 4 has been in the works for a while, and since
[#516100](https://github.com/NixOS/nixpkgs/pull/516100) nixpkgs ships it as
`maven_4` (initially at 4.0.0-rc5, with the rc bumps following since). The
package comes with its own `maven_4.buildMavenPackage` hook that works exactly
like the 3.x one, so adopting Maven 4 for a package is a one-word change:

```nix
maven_4.buildMavenPackage (finalAttrs: {
  # same arguments as maven.buildMavenPackage
})
```

It lives alongside the stable `maven` package rather than replacing it, so
packages can opt in deliberately. The one deliberate difference: `maven_4`
doesn't provide the deprecated `buildMaven` helper.

The first package using it is
[jfmt-java](https://github.com/NixOS/nixpkgs/pull/571332), a Java source
formatter I added in October. It's a small tool, but it means the Maven 4 hook
has been exercised by a real package proving that it actually works.
As Maven 4 gets closer to it's GA release, I expect more and more packages
moving over to it.

## Small fixes: logs and tests

I also made a few smaller changes here and there, that make working with the
Maven package better.

The first is as boring as it gets:
[#391657](https://github.com/NixOS/nixpkgs/pull/391657) added a test that
verifies the `maven` package itself actually works, using the `testVersion`
fixture. Since the `maven` package gets automatic version bumps and other
changes of its own, it makes sense to have some sanity checks.
Before this test was added, making sure `mvn` still works with the `maven`
package required building it on a maintainer machine and running it.
Now it happens automatically, which surfaces problems directly in the CI
pipeline.

The second touches the thing you do most often when a package fails to build:
reading the log. The `mvn` commands inside the dependency FOD used to run with
their default output, progress bars and download messages included, so
`nix log` on `fetchedMavenDeps` drowned in download noise with the actual error
somewhere in the middle of it.
[#501020](https://github.com/NixOS/nixpkgs/pull/501020) runs those commands in
batch mode (`-B`), which keeps the progress output out of the log.
It's a small change, but it makes debugging a failing FOD build a lot easier.

## Conclusion

I think the maven build support is in better shape than it was a year ago.
Most of it is invisible unless you package Java software with Nix (which
I don't think a lot of people do...).

If you need help packaging Java applications with Nix, or with NixOS in
general, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch with me!
