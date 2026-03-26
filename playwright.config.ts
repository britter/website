import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",

  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "firefox",
      testMatch: "**/visual-regression.spec.ts",
      use: {
        ...devices["Desktop Firefox"],
        colorScheme: "light",
      },
    },
    {
      name: "functional",
      testMatch: "**/functional.spec.ts",
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
