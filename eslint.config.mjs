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
    // Not project source: agent worktrees are throwaway repo copies and
    // graphify-out is generated. Linting them produced ~5000 phantom
    // problems that buried the real ones.
    ".claude/worktrees/**",
    "graphify-out/**",
    "scratch/**",
  ]),
]);

export default eslintConfig;
