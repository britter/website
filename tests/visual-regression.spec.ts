import { test, expect } from "@playwright/test";

const mask = (page: any) => [page.locator("#footer-copyright")];

test.describe("Visual Regression Tests", () => {
  test("homepage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500); // Extra settling time for images/fonts
    await expect(page).toHaveScreenshot("homepage.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      mask: mask(page),
    });
  });

  test("vita page", async ({ page }) => {
    await page.goto("/vita");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("vita.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  test("open source page", async ({ page }) => {
    await page.goto("/open-source");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("open-source.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  test("services - gradle", async ({ page }) => {
    await page.goto("/services/gradle");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("services-gradle.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  test("services - nixos", async ({ page }) => {
    await page.goto("/services/nixos");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("services-nixos.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  test("terms page", async ({ page }) => {
    await page.goto("/terms");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("terms.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  // Blog posts — each exercises different formatting features
  test("blog post - mdx with inline images (oceansprint)", async ({ page }) => {
    await page.goto("/blog/2025/04/01/oceansprint-2025");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("blog-oceansprint-mdx.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  test("blog post - callouts (gradle dependency verification)", async ({
    page,
  }) => {
    await page.goto("/blog/2025/02/10/gradle-dependency-verification");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("blog-gradle-verification.png", {
      fullPage: true,
      mask: mask(page),
    });
  });

  test("blog post - footnotes (maven ai agents)", async ({ page }) => {
    await page.goto("/blog/2025/10/26/maven-ai-agents");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("blog-maven-ai.png", {
      fullPage: true,
      mask: mask(page),
    });
  });
});
