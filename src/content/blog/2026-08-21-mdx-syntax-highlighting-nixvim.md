---
title: "MDX Syntax Highlighting in NixVim"
description: "How to get syntax highlighting for MDX files working in Neovim using NixVim."
topics: ["NixOS", "Neovim"]
---

My blog is build with [Astro](https://astro.build) which has nice support for writing pages using Markdown or MDX.
The latter is a Markdown extension that allows for mixing in TypeScript code.
So naturally I want the same syntax highlighting when I edit MDX blogposts with [Neovim](https://neovim.io) that I'm used to from Markdown editing.
However when opening an MDX file, it does not have hightlighting at all.

After searching for this I picked up the approach from [Moriz Büsing's blog post on MDX support in NvChad](https://morizbuesing.com/blog/mdx-support-in-nvchad/).
The fix is not complicated, but it involves three things: telling Neovim what filetype `.mdx` files are, telling treesitter which parser to use, and injecting TypeScript highlighting into import/export lines.
Since I manage my Neovim setup with [NixVim](https://github.com/nix-community/nixvim), I had to translate the raw Lua configuration from the blog post to Nix.

## The filetype registration

Neovim doesn't know `.mdx` files exist out of the box.
You need to tell it:

```nix
filetype.extension.mdx = "mdx";
```

This is the NixVim equivalent of calling `vim.filetype.add` in Lua.
Neovim will now recognize `.mdx` files and set the filetype to `mdx`.

## Registering the treesitter parser

Treesitter has a `markdown` parser, but it won't apply it to the `mdx` filetype unless you tell it to.
NixVim exposes this via `plugins.treesitter.languageRegister`:

```nix
plugins.treesitter.languageRegister.markdown = "mdx";
```

This tells treesitter to use the `markdown` parser for files with the `mdx` filetype.
The Markdown part of the document now highlights correctly.

## Injecting TypeScript for imports and exports

The last piece is getting `import` and `export` statements highlighted as TypeScript.
The source blog post lists some treesitter injections that make it work.
Honestly, this part I just copied without understanding every line.
I verified that it worked an moved on.
If you're curious about how this part of the config works exactly, I highly recommend reading [this blog post](https://phelipetls.github.io/posts/mdx-syntax-highlight-treesitter-nvim/) which explains it in detail.

NixVim's `extraFiles` option lets you drop arbitrary files into Neovim's runtime path.
Placing a file at `after/queries/markdown/injections.scm` extends the default markdown injection queries:

```nix
extraFiles."after/queries/markdown/injections.scm".text =
  ''
    ; extends
    ((inline) @injection.content
      (#lua-match? @injection.content "^%s*import")
      (#set! injection.language "typescript"))
    ((inline) @injection.content
      (#lua-match? @injection.content "^%s*export")
      (#set! injection.language "typescript"))
  '';
```

## Putting it all together

All of this lives in a single Nix file:

```nix
programs.nixvim = {
  filetype.extension.mdx = "mdx";
  plugins.treesitter.languageRegister.markdown = "mdx";
  extraFiles."after/queries/markdown/injections.scm".text =
    # scheme
    ''
      ; extends
      ((inline) @injection.content
        (#lua-match? @injection.content "^%s*import")
        (#set! injection.language "typescript"))
      ((inline) @injection.content
        (#lua-match? @injection.content "^%s*export")
        (#set! injection.language "typescript"))
    '';
};
```

Having this all in Nix means I can now roll it out to all my machines with a single command.

## Acknowledgements

This post is based on [this commit](https://github.com/britter/nix-configuration/commit/285a84e6b99bb508f5b9961aa8692013ac517b47) in my nix-configuration repository.
The original approach comes from [Moriz Büsing](https://morizbuesing.com/blog/mdx-support-in-nvchad/), who in turn built on [Phelipe Teles' earlier post](https://phelipetls.github.io/posts/mdx-syntax-highlight-treesitter-nvim/) on the same topic.

If you need help setting up NixVim or configuring Neovim for your team, I offer [NixOS consulting services](/services/nixos).
Feel free to reach out!
