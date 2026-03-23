// originally copied from https://www.tomspencer.dev/blog/2023/12/05/date-based-urls-with-astro/
import type { CollectionEntry } from "astro:content";

function parseDateParts(post: CollectionEntry<"blog">) {
  const match = post.id.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match)
    throw new Error(`Cannot parse date from blog post ID: ${post.id}`);
  return { pubYear: match[1], pubMonth: match[2], pubDay: match[3] };
}

export function getPubDate(post: CollectionEntry<"blog">): Date {
  const { pubYear, pubMonth, pubDay } = parseDateParts(post);
  return new Date(`${pubYear}-${pubMonth}-${pubDay}T00:00:00`);
}

export function getBlogParams(post: CollectionEntry<"blog">) {
  const { pubYear, pubMonth, pubDay } = parseDateParts(post);

  // Astro generates the `id` from the filename of the content (including extension).
  // Our filenames begin with `YYYY-MM-DD-`, but we don't want this in our resulting URL.
  // Strip the file extension first, then remove the date prefix if it exists.
  const postId = post.id.replace(/\.[^/.]+$/, "");
  const slug = (postId.match(/\d{4}-\d{2}-\d{2}-(.+)/) || [])[1] || postId;

  // Build our desired date-based path from the relevant parts.
  const path = `${pubYear}/${pubMonth}/${pubDay}/${slug}`;

  return {
    year: pubYear,
    month: pubMonth,
    day: pubDay,
    path,
    slug,
  };
}
