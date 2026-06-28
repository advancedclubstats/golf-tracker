import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The owner-only /pm route reads docs/pm-loop/decisions.json at request time.
  // That folder isn't traced into the serverless bundle by default, so include
  // it explicitly — keeps the file as the single source of truth (vs. importing
  // a build-time snapshot) and lets the page read it live in production.
  outputFileTracingIncludes: {
    "/pm": ["./docs/pm-loop/decisions.json"],
  },
};

export default nextConfig;
