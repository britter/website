// originally copied from https://www.tomspencer.dev/blog/2023/12/05/date-based-urls-with-astro/
import type { CollectionEntry } from "astro:content";

type ImageModule = { default: { src: string } };
const images = import.meta.glob("../assets/**", { eager: true }) as ImageModule;

export function getBlogParams(post: CollectionEntry<"blog">) {
  // Grab the `pubDate` from the blog post's frontmatter.
  // This will be of type `Date`, since the `CollectionEntry` of type 'blog'
  // defines the `pubDate` field as type 'Date'.
  const pubDate: Date = post.data.pubDate;
  console.log(typeof pubDate);

  // Parse out the year, month and day from the `pubDate`.
  const pubYear = String(pubDate.getFullYear()).padStart(4, "0");
  const pubMonth = String(pubDate.getMonth() + 1).padStart(2, "0");
  const pubDay = String(pubDate.getDate()).padStart(2, "0");

  // Astro generates the `slug` from the filename of the content.
  // Our filenames begin with `YYYY-MM-DD-`, but we don't want this in our resulting URL.
  // So, we use a regex to remove this prefix, if it exists.
  const slug =
    (post.slug.match(/\d{4}-\d{2}-\d{2}-(.+)/) || [])[1] || post.slug;

  // Build our desired date-based path from the relevant parts.
  const path = `${pubYear}/${pubMonth}/${pubDay}/${slug}`;

  let image = "";
  if (post.data.image) {
    const imagePath = `../assets/${post.data.image}`;
    if (imagePath in images) {
      image = images[imagePath].default.src;
    } else {
      image = post.data.image;
    }
  }

  // Return each token so it can be used by calling code.
  return {
    year: pubYear,
    month: pubMonth,
    day: pubDay,
    path,
    slug,
    image,
  };
}
