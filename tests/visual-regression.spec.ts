import { test, expect } from "@playwright/test";

test.describe("Visual Regression Tests", () => {
  test("homepage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500); // Extra settling time for images/fonts
    await expect(page).toHaveScreenshot("homepage.png", {
      fullPage: true,
      // Small tolerance for font rendering/subpixel variations between runs
      maxDiffPixelRatio: 0.02,
    });
  });

  test("services index", async ({ page }) => {
    await page.goto("/services");
    await expect(page).toHaveScreenshot("services-index.png", {
      fullPage: true,
    });
  });

  test("services - gradle", async ({ page }) => {
    await page.goto("/services/gradle");
    await expect(page).toHaveScreenshot("services-gradle.png", {
      fullPage: true,
    });
  });

  test("services - nixos", async ({ page }) => {
    await page.goto("/services/nixos");
    await expect(page).toHaveScreenshot("services-nixos.png", {
      fullPage: true,
    });
  });

  test("services - dpe", async ({ page }) => {
    await page.goto("/services/dpe");
    await expect(page).toHaveScreenshot("services-dpe.png", { fullPage: true });
  });

  test("services - engineering growth", async ({ page }) => {
    await page.goto("/services/engineering-growth");
    await expect(page).toHaveScreenshot("services-engineering-growth.png", {
      fullPage: true,
    });
  });

  test("blog listing", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveScreenshot("blog-listing.png", { fullPage: true });
  });

  test("terms page", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveScreenshot("terms.png", { fullPage: true });
  });

  // Blog posts with special features
  test("blog post - mdx format (oceansprint)", async ({ page }) => {
    await page.goto("/blog/2025/04/01/oceansprint-2025");
    await expect(page).toHaveScreenshot("blog-oceansprint-mdx.png", {
      fullPage: true,
    });
  });

  test("blog post - with footnotes and callouts", async ({ page }) => {
    await page.goto("/blog/2025/02/10/gradle-dependency-verification");
    await expect(page).toHaveScreenshot("blog-gradle-verification.png", {
      fullPage: true,
    });
  });

  test("blog post - maven ai agents (recent with footnotes)", async ({
    page,
  }) => {
    await page.goto("/blog/2025/10/26/maven-ai-agents");
    await expect(page).toHaveScreenshot("blog-maven-ai.png", {
      fullPage: true,
    });
  });
});
