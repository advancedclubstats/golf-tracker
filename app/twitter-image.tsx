// Twitter/X share card: identical to the Open Graph image. The route-segment
// config (runtime) and image metadata must be statically declared here (Next
// can't follow a re-export for these), but the renderer is shared so there's
// one source of truth for the actual image.
import OpengraphImage from "./opengraph-image";

export const runtime = "nodejs";

export const alt = "Round Recall — Strokes-gained golf analytics, tracked from memory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OpengraphImage;
