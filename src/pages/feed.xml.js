import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getBlogParams, getPubDate } from "../utils/params";

export async function GET(context) {
  const blog = await getCollection("blog");
  const sorted = blog.sort(
    (a, b) => getPubDate(b).getTime() - getPubDate(a).getTime()
  );
  return rss({
    title: "Reproducible Thoughts",
    description:
      "Notes from the intersection of Gradle, NixOS, and a decade of building software that actually works.",
    site: context.site,
    items: sorted.map(post => ({
      title: post.data.title,
      pubDate: getPubDate(post),
      description: post.data.description,
      link: `/blog/${getBlogParams(post).path}`,
    })),
    customData: `<language>en-us</language>`,
  });
}
