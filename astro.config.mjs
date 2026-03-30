import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import remarkCalloutDirectives from "@microflash/remark-callout-directives";
import githubCalloutOptions from "@microflash/remark-callout-directives/config/github";
import remarkDirective from "remark-directive";
import mdx from "@astrojs/mdx";
import mermaid from "astro-mermaid";

import react from "@astrojs/react";

export default defineConfig({
  integrations: [mermaid(), icon(), react(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
  redirects: {
    "/blogs": "/blog",
    "/blogs/2025-01-02-gradle-nix": "/blog/2025/01/02/gradle-nix",
    "/blogs/2024-12-20-hello-world": "/blog/2024/12/20/hello-world",
    "/services": "/",
    "/services/dpe": "/",
    "/services/engineering-growth": "/",
  },
  site: "https://britter.dev",
  markdown: {
    remarkPlugins: [
      remarkDirective,
      [remarkCalloutDirectives, githubCalloutOptions],
    ],
  },
});
