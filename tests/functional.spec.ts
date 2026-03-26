import { test, expect } from "@playwright/test";

test.describe("Meta tags", () => {
  test("blog post og:image is an absolute URL", async ({ request }) => {
    const response = await request.get("/blog/2026/03/26/website-redesign");
    const html = await response.text();
    const match = html.match(/<meta property="og:image" content="([^"]+)"/);
    expect(match?.[1]).toMatch(/^https?:\/\//);
  });

  test("homepage og:image is an absolute URL", async ({ request }) => {
    const response = await request.get("/");
    const html = await response.text();
    const match = html.match(/<meta property="og:image" content="([^"]+)"/);
    expect(match?.[1]).toMatch(/^https?:\/\//);
  });
});

test.describe("Page titles", () => {
  test("blog listing title", async ({ request }) => {
    const response = await request.get("/blog");
    const html = await response.text();
    const match = html.match(/<title>([^<]+)<\/title>/);
    expect(match?.[1]).toBe("Reproducible Thoughts — Benedikt Ritter");
  });

  test("blog post title includes brand", async ({ request }) => {
    const response = await request.get("/blog/2026/03/26/website-redesign");
    const html = await response.text();
    const match = html.match(/<title>([^<]+)<\/title>/);
    expect(match?.[1]).toContain("— Reproducible Thoughts");
  });

  test("topic page title includes brand", async ({ request }) => {
    const response = await request.get("/blog/topic/NixOS");
    const html = await response.text();
    const match = html.match(/<title>([^<]+)<\/title>/);
    expect(match?.[1]).toContain("— Reproducible Thoughts");
  });
});

test.describe("RSS feed", () => {
  test("returns 200 with XML content type", async ({ request }) => {
    const response = await request.get("/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
  });

  test("contains at least one item", async ({ request }) => {
    const response = await request.get("/feed.xml");
    const xml = await response.text();
    expect(xml).toContain("<item>");
  });

  test("items are sorted newest first", async ({ request }) => {
    const response = await request.get("/feed.xml");
    const xml = await response.text();
    const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(m =>
      new Date(m[1]).getTime()
    );
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});

test.describe("Redirects", () => {
  test("/blogs redirects to /blog", async ({ request }) => {
    const response = await request.get("/blogs");
    expect(response.status()).toBe(200);
    expect(response.url()).toContain("/blog");
  });

  test("/services redirects to homepage", async ({ request }) => {
    const response = await request.get("/services");
    expect(response.status()).toBe(200);
    expect(new URL(response.url()).pathname).toBe("/");
  });

  test("/blogs/2025-01-02-gradle-nix redirects to new URL", async ({
    request,
  }) => {
    const response = await request.get("/blogs/2025-01-02-gradle-nix");
    expect(response.status()).toBe(200);
    expect(response.url()).toContain("/blog/2025/01/02/gradle-nix");
  });

  test("/blogs/2024-12-20-hello-world redirects to new URL", async ({
    request,
  }) => {
    const response = await request.get("/blogs/2024-12-20-hello-world");
    expect(response.status()).toBe(200);
    expect(response.url()).toContain("/blog/2024/12/20/hello-world");
  });
});
