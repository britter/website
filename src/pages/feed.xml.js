import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getBlogParams, getPubDate, getUpdatedDate } from "../utils/params";
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
    items: sorted.map(post => {
      const updatedDate = getUpdatedDate(post);
      return {
        title: post.data.title,
        pubDate: getPubDate(post),
        description: post.data.description,
        link: `/blog/${getBlogParams(post).path}`,
        ...(updatedDate && {
          // RSS has no item-level "updated" element; atom:updated is the
          // de-facto extension used by feed readers.
          customData: `<atom:updated xmlns:atom="http://www.w3.org/2005/Atom">${updatedDate.toISOString()}</atom:updated>`,
        }),
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
