import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getBlogParams } from '../utils/params';

export async function GET(context) {
  const blog = await getCollection('blog');
  return rss({
    title: "Benedikt Ritter's Blog",
    description: 'Articles about Developer Productivity, Gradle Build Tool, and NixOS',
    site: context.site,
    items: blog.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${getBlogParams(post).path}`,
    })),
    customData: `<language>en-us</language>`,
  });
}
