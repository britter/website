import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { ogBranding, renderOgTemplate } from "../../../utils/og";

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection("blog");
  const topics = [...new Set(posts.flatMap(p => p.data.topics ?? []))];
  return topics.map(topic => ({ params: { topic } }));
};

export const GET: APIRoute = async ({ params }) => {
  const topic = params.topic as string;

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
        ogBranding("Technical Journal"),

        // Middle: topic name
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: "20px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#7dd3fc",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  },
                  children: "Topic",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: topic.length > 20 ? "56px" : "72px",
                    fontWeight: 900,
                    color: "white",
                    lineHeight: 1.1,
                  },
                  children: topic,
                },
              },
            ],
          },
        },

        // Bottom: journal name
        {
          type: "div",
          props: {
            style: {
              fontSize: "24px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.05em",
            },
            children: "britter.dev",
          },
        },
      ],
    },
  };

  return renderOgTemplate(template);
};
