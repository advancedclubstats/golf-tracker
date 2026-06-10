import { ImageResponse } from "next/og";

// Branded social share card for Round Recall. Rendered with next/og (no external
// screenshot) at the canonical 1200×630. Colors are the Modern Clubhouse brand
// tokens (paper / fairway / ball-lime) — see app/globals.css. next/og renders
// outside the DOM, so the CSS variables aren't available here; these literals
// are the documented values of the existing tokens, not new brand colors.
export const runtime = "nodejs";

export const alt = "Round Recall — Strokes-gained golf analytics, tracked from memory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand token values (from app/globals.css):
const PAPER = "#F6F3EC"; // --background warm paper
const INK = "#14201A"; // --foreground deep green-charcoal
const FAIRWAY = "#15784A"; // --primary fairway-700
const LIME = "#CDF23E"; // --highlight ball-lime
const INK_500 = "#66726B"; // --muted-foreground

// Load the app's display face (Bricolage Grotesque) for the wordmark. Fetched
// per the next/og docs and wrapped so a fetch failure falls back to the bundled
// default font rather than breaking the build.
async function loadFont(
  weight: number,
): Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: "normal" } | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@${weight}`,
      {
        headers: {
          // A browser UA makes Google return woff2/ttf URLs we can decode.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return { name: "Bricolage Grotesque", data, weight: weight as 400 | 700 | 800, style: "normal" };
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [display, displayLight] = await Promise.all([loadFont(800), loadFont(400)]);
  const fonts = [display, displayLight].filter(
    (f): f is NonNullable<typeof f> => f !== null,
  );
  const fontFamily = fonts.length ? "Bricolage Grotesque" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PAPER,
          fontFamily,
          position: "relative",
        }}
      >
        {/* SG accent mark: ball-lime dot above the wordmark */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 64,
            backgroundColor: LIME,
            marginBottom: 44,
            boxShadow: `0 0 0 12px ${PAPER}, 0 0 0 14px rgba(20,32,26,0.06)`,
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: INK,
            lineHeight: 1,
          }}
        >
          Round Recall
        </div>

        {/* Lime rule under the wordmark */}
        <div
          style={{
            width: 120,
            height: 8,
            borderRadius: 8,
            backgroundColor: LIME,
            margin: "40px 0 36px",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 400,
            color: INK_500,
            letterSpacing: "-0.01em",
          }}
        >
          Strokes-gained golf analytics, tracked from memory
        </div>

        {/* Corner brand footer */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            right: 56,
            fontSize: 26,
            fontWeight: 700,
            color: FAIRWAY,
            letterSpacing: "0.02em",
          }}
        >
          roundrecall.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length ? fonts : undefined,
    },
  );
}
