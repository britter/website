---
title: "Packaging a Custom OpenTofu Provider with Nix"
description: "How to build and use a fork of an OpenTofu provider in a Nix devShell using mkProvider and withPlugins, scoped to a project, reproducible, and easy to throw away."
topics: ["NixOS", "OpenTofu", "Home Lab"]
---

At the beginning of this year I upgraded my home lab network from a Fritzbox to [Ubiquiti UniFi](https://www.ui.com) gear, with a [UniFi Dream Machine Pro](https://store.ui.com/us/en/products/udm-pro) as the gateway, plus a few access points and switches.
The hardware is excellent, but the initial setup was done entirely through the web UI.
That was fine at first, but it didn't take long before the configuration grew into something I could no longer comfortably reason about: multiple VLANs, firewall rules between them, static DNS entries, DHCP reservations.
Making a change meant clicking through several screens, hoping I didn't accidentally break something, and having no record of what the state looked like before.

The obvious solution was to manage it with [OpenTofu](https://opentofu.org).
There's a community-maintained [UniFi provider](https://github.com/ubiquiti-community/terraform-provider-unifi) that covers exactly this use case, but I immediately ran into a problem.

## A Broken Provider

As soon as I started using the provider, I got recurring crashes: `The plugin encountered an error, and failed to respond to the plugin6.(*GRPCProvider).ReadResource call`.
The strangest part: running with `TF_LOG=INFO` made it go away sometimes.

Looking at the provider source, I found a race condition in its logger implementation.
[`UnifiLogger`](https://github.com/ubiquiti-community/terraform-provider-unifi/blob/main/unifi/logger.go) stores a single `context.Context` shared across all goroutines.
When log masking is active (which it is when you configure `unifi_password` or `unifi_api_key`), `tflog`'s `ApplyMask` mutates the context's fields map in-place.
Meanwhile, `go-retryablehttp` fires concurrent HTTP requests during a `tofu plan` refresh, each of which calls into the logger simultaneously.
Two goroutines write to the same map at the same time, and Go's runtime kills the process:

```
fatal error: concurrent map writes
  logging.LoggerOpts.ApplyMask()
    tflog.Debug()
      (*UnifiLogger).Debug()       ← logger.go:48, no mutex
        go-retryablehttp.(*Client).Do()
```

The fix is a `sync.Mutex` on `UnifiLogger` to serialize all logging calls.
I submitted [PR #127](https://github.com/ubiquiti-community/terraform-provider-unifi/pull/127), but the maintainer hasn't responded yet.
In the meantime, I need to use my fork.

## The Manual Way

Without Nix, using a custom provider build looks roughly like this: clone the fork, make sure you have a Go toolchain installed, and run `go install`, which compiles the provider and puts the binary into `$GOPATH/bin` (usually `~/go/bin`).
Then write a `~/.tofurc` pointing OpenTofu at that directory:

```hcl
provider_installation {
  dev_overrides {
    "registry.terraform.io/ubiquiti-community/unifi" = "/home/you/go/bin"
  }
  direct {}
}
```

It works, but it comes with real costs.
The Go toolchain has to be globally available.
The binary lands in `~/go/bin`, a global location shared across all your projects.
The `~/.tofurc` is global too and affects every project on your machine.
Going back to the upstream release means manual cleanup.
You have to remember to remove the config file and the binary.
And none of it is reproducible: a colleague checking out the same project gets none of this automatically.

## The Nix Way: Packaging the Provider

One thing I appreciate about nixpkgs is how many domain-specific helpers it ships alongside the packages themselves.
I've written about `pkgs.formats.yaml` in my [post about tmuxinator](/blog/2026/03/23/home-manager-tmuxinator/) and about `gradle.fetchDeps` in my [post about building Gradle projects with Nix](/blog/2025/01/02/gradle-nix/).
The pattern is the same: wherever a package has a well-known customization use case, nixpkgs tends to have a helper for it attached to the package as an extra attribute, a nixpkgs convention called `passthru`.

The downside of these helpers is that they're rarely well documented, and you won't find much on the NixOS wiki or in blog posts.
My approach whenever I need to figure out if a helper exists and how to use it: search for the package on [search.nixos.org](https://search.nixos.org/packages), then follow the link to the source.
Reading the implementation directly is usually the fastest way to understand what parameters it accepts.

That's how I found `mkProvider` in `pkgs.terraform-providers`, a helper specifically for packaging [Terraform](https://www.terraform.io) (and [OpenTofu](https://opentofu.org)) providers.
It takes care of building the Go binary, injecting the version, and installing everything where OpenTofu expects to find it.
All you supply are the source coordinates and hashes:

```nix
terraform-provider-unifi-fork = pkgs.terraform-providers.mkProvider {
  owner = "britter";
  repo = "terraform-provider-unifi";
  rev = "2eb1d1ab9d1ecbb323f8ba4d346dfedfd95a6fdc";
  version = "0.41.25-britter";
  hash = "sha256-8ixnM6FRf0fYKz2FdcI0wiSly8tRofMI2zes7MdcaU8=";
  vendorHash = "sha256-OVdhM8Zqnm1J8KducnkNkroBoSLER3fHfZBjyp7kBu8=";
  homepage = "https://registry.terraform.io/providers/ubiquiti-community/unifi";
  provider-source-address = "registry.terraform.io/ubiquiti-community/unifi";
};
```

The `rev` pins the exact commit on my fork that contains the race condition fix.
The `version` is arbitrary. I picked `0.41.25-britter` to make it clear this is a custom build based on the upstream `0.41.25` release.
To get the hashes, use `nix-prefetch-github` for the source hash, then attempt a build with `vendorHash = lib.fakeHash`. Nix will error and print the correct hash.

## Wiring It Into a devShell with `withPlugins`

Another useful `passthru` helper, this time on `pkgs.opentofu` itself: `withPlugins`.
It wraps the OpenTofu binary with a set of providers baked in, generating the plugin directory structure at build time and setting the appropriate environment variable so OpenTofu finds the providers automatically, with no `.tofurc`, no `dev_overrides`, nothing to configure at runtime.

In `flake.nix`:

```nix
devShells.default = pkgs.mkShell {
  packages = [
    (pkgs.opentofu.withPlugins (_: [ terraform-provider-unifi-fork ]))
  ];
};
```

That's it.
Running `nix develop` drops you into a shell where `tofu` is the wrapped binary with your fork pre-loaded.
The provider is scoped entirely to this devShell: it doesn't touch your global OpenTofu install, it doesn't affect any other project, and it travels with the repository.
Anyone who checks out the project and runs `nix develop` gets the exact same setup automatically.

One caveat: `tofu version` reads the provider version from the `.terraform.lock.hcl` lock file, not from the binary, so it will show whatever version is pinned there regardless of what `withPlugins` has provided.
This doesn't mean the wrong binary is being used.

To verify the fix is actually in place, inspect the `tofu` wrapper script:

```sh
cat $(which tofu)
```

The wrapper sets an environment variable pointing to a directory in the Nix store that contains all the providers baked in by `withPlugins`.
Listing that directory will show `0.41.25-britter`, which confirms that the fork is the one being executed.

:::note
Unfortunately managing providers using `withPlugins` is an all or nothing decision.
If you use `withPlugins` OpenTofu will not find providers not managed this way anymore.
So if your OpenTofu project uses multiple providers, you have to move them all into `withPlugins`.
Luckily lots of providers are prepackaged already and accessible as attributes on `pkgs.terraform-providers`.
:::

## The Exit Strategy

The whole point of this setup is that it's temporary.
When [PR #127](https://github.com/ubiquiti-community/terraform-provider-unifi/pull/127) is merged and a new release is cut, reverting the fix is simple:

- Remove the `mkProvider` derivation
- Remove `withPlugins`, switching back to plain `pkgs.opentofu`
- Bump the version constraint in `required_providers`

No leftover config files, no orphaned binaries, no global state to clean up.
With Nix, the custom build is just gone once you remove the reference.

## Conclusion

The whole reason I wanted to use OpenTofu was to manage my network declaratively, without clicking through screens or keeping track of manual state.
A broken provider almost stopped me before I got started.
What I like about this solution is that it follows the same principle: the workaround is itself declarative, reproducible, and scoped to the project.
No manual steps, nothing global, and when the upstream fix is released the cleanup is just a few lines in `flake.nix`.

If you need help with NixOS or infrastructure automation, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch!
