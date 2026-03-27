import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { getPubDate } from "../../utils/params";
import { ogBranding, renderOgTemplate } from "../../utils/og";
import { blog, basic } from "../../config/data.json";

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection("blog");
  return posts.map(post => ({
    params: { id: post.id.replace(/\.[^/.]+$/, "") },
    props: { post },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as any;

  const title: string = post.data.title;
  const topics: string[] = post.data.topics ?? [];
  const pubDate: Date = getPubDate(post);

  const dateStr = pubDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const template: any = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        backgroundColor: "#1d2b3e",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px",
        fontFamily: "Inter",
      },
      children: [
        ogBranding(blog.name),

        // Middle: title
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: title.length > 50 ? "48px" : "60px",
                    fontWeight: 900,
                    color: "white",
                    lineHeight: 1.1,
                    maxWidth: "900px",
                  },
                  children: title,
                },
              },
            ],
          },
        },

        // Bottom: topics + author/date
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", gap: "8px", flexWrap: "wrap" },
                  children: topics.slice(0, 4).map((topic: string) => ({
                    type: "div",
                    props: {
                      style: {
                        backgroundColor: "rgba(255,255,255,0.08)",
                        color: "#7dd3fc",
                        fontSize: "20px",
                        fontWeight: 700,
                        padding: "6px 14px",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "1px solid rgba(125,211,252,0.3)",
                      },
                      children: topic,
                    },
                  })),
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "4px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "white",
                        },
                        children: basic.name,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "20px",
                          color: "rgba(255,255,255,0.5)",
                        },
                        children: dateStr,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return renderOgTemplate(template);
};
