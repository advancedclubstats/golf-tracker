import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Enforce layer boundary: components/ must not import lib/db/ directly.
    // All DB access from components must go through actions/ only.
    // Server component pages in app/ are allowed to call lib/db/ directly (D-05).
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*/lib/db/*", "@/lib/db/*", "../lib/db/*", "../../lib/db/*"],
              message:
                "Import lib/db/ through actions/ only. Pages and components must not access the database directly.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
