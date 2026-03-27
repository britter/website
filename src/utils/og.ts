import { readFileSync } from "fs";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

// Font source: @fontsource/inter — update the package version to change fonts.
// https://www.npmjs.com/package/@fontsource/inter
function loadFont(weight: 700 | 900): Buffer {
  const path = import.meta.resolve(
    `@fontsource/inter/files/inter-latin-${weight}-normal.woff`
  );
  return readFileSync(new URL(path));
}

const fontBold = loadFont(700);
const fontBlack = loadFont(900);

/** Shared top branding row: BR monogram + label */
export function ogBranding(label = "Reproducible Thoughts") {
  return {
    type: "div",
    props: {
      style: { display: "flex", alignItems: "center", gap: "12px" },
      children: [
        {
          type: "div",
          props: {
            style: {
              width: "56px",
              height: "56px",
              border: "2px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: 900,
              color: "white",
            },
            children: "BR",
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "24px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            },
            children: label,
          },
        },
      ],
    },
  };
}

export async function renderOgTemplate(template: any): Promise<Response> {
  const svg = await satori(template, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "Inter",
        data: fontBold.buffer as ArrayBuffer,
        weight: 700,
        style: "normal",
      },
      {
        name: "Inter",
        data: fontBlack.buffer as ArrayBuffer,
        weight: 900,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const png = resvg.render().asPng();

  return new Response(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
