import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    image: z.string().optional(),
  }),
});

export const collections = {
  blog: blog,
};
