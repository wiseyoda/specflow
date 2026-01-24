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
  // T030: Prevent setInterval in hooks for data polling
  // Use SSE/file watching instead of polling
  {
    files: ["src/hooks/**/*.ts", "src/hooks/**/*.tsx"],
    rules: {
      "no-restricted-globals": [
        "warn",
        {
          name: "setInterval",
          message: "Avoid setInterval in hooks for data polling. Use SSE events from useUnifiedData instead.",
        },
      ],
    },
  },
]);

export default eslintConfig;
