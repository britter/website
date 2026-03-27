import type { APIRoute } from "astro";
import { ogBranding, renderOgTemplate } from "../../utils/og";

export const GET: APIRoute = async () => {
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

        // Middle: journal name
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: "24px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "72px",
                    fontWeight: 900,
                    color: "white",
                    lineHeight: 1.1,
                  },
                  children: "Reproducible Thoughts",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "0.05em",
                  },
                  children: "A developer journal by Benedikt Ritter",
                },
              },
            ],
          },
        },

        // Bottom: author
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
