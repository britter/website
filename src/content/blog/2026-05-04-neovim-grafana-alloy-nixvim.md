---
title: "NeoVim Support for Grafana Alloy Files with NixVim"
description: "How I added syntax highlighting, formatting, and diagnostics for Grafana Alloy files to NeoVim using NixVim — with the grammar and the alloy binary both coming straight from nixpkgs."
topics: ["NixOS", "NixVim", "Grafana Alloy"]
---

I've been setting up telemetry for one of my projects using [OpenTelemetry](https://opentelemetry.io/) with [Grafana Alloy](https://grafana.com/docs/alloy/latest/) as the collector.
Alloy uses its own configuration language — a dialect of HCL with some extensions — and out of the box NeoVim has no idea what to do with `.alloy` files.
Opening one feels like this:

<!-- TODO: screenshot 1 — alloy file open in NeoVim without any config: no highlighting, just plain text -->

My NeoVim configuration is managed through [NixVim](https://nix-community.github.io/nixvim/), which means adding editor support for a new language is a Nix problem.
This post follows the same pattern I used when [packaging kotlin-lsp for NixVim](/blog/2025/11/15/kotlin-lsp-nixvim): reference the tools you need directly from nixpkgs and let Nix wire everything together.
Here is how it looks for Grafana Alloy.

## Syntax Highlighting via Treesitter

NeoVim's syntax highlighting is powered by [Treesitter](https://tree-sitter.github.io/).
Treesitter needs a parser for each language it supports, and there is no Grafana Alloy grammar bundled with `nvim-treesitter`.
[Matt Conway](https://github.com/mattsre) wrote one — [tree-sitter-alloy](https://github.com/mattsre/tree-sitter-alloy) — which I came across while looking for a solution.
I donated to his work as part of my [Advent of Donations](/blog/2025/12/01/advent-of-donations) last year; if the grammar helps you too, consider doing the same.

With vanilla NeoVim you'd install the grammar at runtime with `:TSInstall`.
With NixVim, I build it with Nix instead:

```nix
let
  treesitter-alloy-grammar = pkgs.tree-sitter.buildGrammar {
    language = "alloy";
    version = "0.0.1+rev=3e18eb4";
    src =
      (pkgs.fetchFromGitHub {
        owner = "mattsre";
        repo = "tree-sitter-alloy";
        rev = "58d462b1cdb077682b130caa324f3822aeb00b8e";
        sha256 = "sha256-yDYGtM/vlZqeOy2O+scGHc6Dae0H/cXyC6Gu0inwJNA=";
      }).overrideAttrs
        (_drv: {
          fixupPhase = ''
            mkdir -p $out/queries/alloy
            mv $out/queries/*.scm $out/queries/alloy/
          '';
        });
    meta.homepage = "https://github.com/mattsre/tree-sitter-alloy";
  };
in
{
  programs.nixvim = {
    filetype.extension.alloy = "alloy";

    plugins.treesitter = {
      grammarPackages =
        pkgs.vimPlugins.nvim-treesitter.passthru.allGrammars
        ++ [ treesitter-alloy-grammar ];

      luaConfig.post = # lua
        ''
          vim.api.nvim_create_autocmd('User', { pattern = 'TSUpdate',
            callback = function()
              require("nvim-treesitter.parsers").alloy = {
                install_info = {
                  url = "${treesitter-alloy-grammar}",
                  files = {"src/parser.c"},
                },
              }
            end
          })
        '';
    };
  };
}
```

`pkgs.tree-sitter.buildGrammar` compiles the grammar from source and puts it in the Nix store.
The `fixupPhase` override moves the query files into a subdirectory named after the language — that's the layout nvim-treesitter expects.

The grammar is registered via `luaConfig.post` rather than through NixVim's declarative treesitter options.
The `TSUpdate` autocmd fires after treesitter initializes, which is the right moment to register a parser that isn't bundled with `nvim-treesitter` itself.
The `url` field points directly into the Nix store via `${treesitter-alloy-grammar}`, which is interpolated at build time.

<!-- TODO: screenshot 2 — same alloy file with treesitter highlighting active -->

## Formatting via none-ls

For formatting I use [none-ls](https://github.com/nvimtools/none-ls.nvim), a framework for connecting external tools to NeoVim's LSP formatting infrastructure.
Grafana Alloy ships a built-in formatter: `alloy fmt`.
It reads from stdin and writes the result to stdout, which maps directly onto none-ls's `formatter_factory` helper:

```lua
local null_ls = require("null-ls")
local helpers = require("null-ls.helpers")

local alloy_fmt = {
  method = null_ls.methods.FORMATTING,
  filetypes = { "alloy" },
  name = "alloy-fmt",
  generator = helpers.formatter_factory({
    command = "${pkgs.grafana-alloy}/bin/alloy",
    args = { "fmt" },
    to_stdin = true,
  }),
}
null_ls.register(alloy_fmt)
```

`${pkgs.grafana-alloy}` is Nix string interpolation inside the `luaConfig` string.
By the time NeoVim sees the Lua, it's an absolute path into the Nix store.

## Diagnostics via none-ls

`alloy validate` checks a configuration file for errors.
The challenge is parsing its output: unlike proper LSP diagnostics, `alloy validate` writes human-readable lines to stderr that look like this:

```
Error: config.alloy:12:5: unexpected block body
```

none-ls's `generator_factory` lets you handle this with a custom `on_output` function.
I match each line with a Lua pattern, extract the fields, and return a diagnostic table:

```lua
local pattern = [[^([%w]+):%s*(.-):(%d+):(%d+):%s*(.*)$]]
local alloy_validate = {
  method = null_ls.methods.DIAGNOSTICS_ON_SAVE,
  filetypes = { "alloy" },
  name = "alloy-validate",
  generator = helpers.generator_factory({
    command = "${pkgs.grafana-alloy}/bin/alloy",
    args = { "validate", "$FILENAME" },
    format = "line",
    to_stdin = false,
    from_stderr = true,
    on_output = function(line, params)
      local severity, filename, lnum, col, msg = line:match(pattern)

      if not severity then
        return nil
      end

      local sevmap = {
        Error   = helpers.diagnostics.severities.error,
        Warning = helpers.diagnostics.severities.warning,
      }

      return {
        row      = tonumber(lnum),
        col      = tonumber(col),
        end_col  = tonumber(col) + 1,
        source   = "alloy",
        message  = msg,
        severity = sevmap[severity] or helpers.diagnostics.severities.error,
        filename = filename,
      }
    end,
  }),
}
null_ls.register(alloy_validate)
```

`from_stderr = true` tells none-ls to read from stderr rather than stdout.
`DIAGNOSTICS_ON_SAVE` runs the validator on every buffer save, so errors show up inline as I work.

<!-- TODO: screenshot 3 — diagnostics visible inline in the editor after a save -->

I've been running both sources in my personal configuration for about half a year.
I've since submitted them as [PR #45](https://github.com/nvimtools/none-ls-extras.nvim/pull/45) to none-ls-extras.nvim.
If the PR is merged by the time you read this, you can use the builtin sources directly instead of the custom Lua above.

## Why NixVim Makes This Nice

Without NixVim, setting this up would involve installing the Alloy binary separately and making sure it's on `PATH`, running `:TSInstall alloy` to fetch the grammar at runtime, and writing Lua that either hard-codes binary paths or hopes the environment is configured correctly when NeoVim starts.

With NixVim, none of that is necessary.
The `alloy` binary comes from `pkgs.grafana-alloy` — the same package I use to actually run Grafana Alloy.
The treesitter grammar is built by Nix from source.
Both are referenced by absolute Nix store path, not by name on `PATH`.
Running `home-manager switch` sets all of it up in one shot, and it works the same way on every machine I deploy my configuration to.

This is the same approach I used for [packaging kotlin-lsp](/blog/2025/11/15/kotlin-lsp-nixvim) and later for [dealing with its native library dependencies](/blog/2026/03/20/kotlin-lsp-nixvim-pt2).
The pattern scales well: whenever a tool has a NeoVim integration that involves an external binary, NixVim lets you replace the manual installation step with a Nix store reference.

The full configuration lives in [`home/terminal/nvim/languages/alloy.nix`](https://github.com/britter/nix-configuration/blob/main/home/terminal/nvim/languages/alloy.nix) in my nix-configuration repository.

If you want help setting up NixVim or adopting NixOS, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch!
