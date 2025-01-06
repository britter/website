import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";

export default defineConfig({
  integrations: [tailwind(), icon()],
  redirects: {
    '/blogs': '/blog',
    '/blogs/2025-01-02-gradle-nix': '/blog/2025/01/02/gradle-nix',
    '/blogs/2024-12-20-hello-world': '/blog/2024/12/20/hello-world'
  }
});
