import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getBlogParams, getPubDate } from "../utils/params";
import { blog as blogData } from "../config/data.json";

export async function GET(context) {
  const blog = await getCollection("blog");
  const sorted = blog.sort(
    (a, b) => getPubDate(b).getTime() - getPubDate(a).getTime()
  );
  return rss({
    title: blogData.name,
    description: blogData.longDescription,
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
