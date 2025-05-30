import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import remarkCalloutDirectives from "@microflash/remark-callout-directives";
import githubCalloutOptions from "@microflash/remark-callout-directives/config/github";
import remarkDirective from "remark-directive";
import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

export default defineConfig({
  integrations: [tailwind(), icon(), react(), mdx()],
  redirects: {
    "/blogs": "/blog",
    "/blogs/2025-01-02-gradle-nix": "/blog/2025/01/02/gradle-nix",
    "/blogs/2024-12-20-hello-world": "/blog/2024/12/20/hello-world",
  },
  site: "https://britter.dev",
  markdown: {
    remarkPlugins: [
      remarkDirective,
      [remarkCalloutDirectives, githubCalloutOptions],
    ],
  },
});
