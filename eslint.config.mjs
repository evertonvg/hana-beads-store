import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["tests/e2e/**"],
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // Project assertion helpers count as assertions.
      "playwright/expect-expect": [
        "warn",
        { assertFunctionNames: ["expect", "expectA11y", "expectTouchTargets"] },
      ],
    },
  },
  {
    files: ["tests/unit/**"],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "storybook-static/**",
    "playwright-report/**",
    "test-results/**",
    "docs/design/**",
    "lib/supabase/database.types.ts",
    ".superpowers/**",
  ]),
  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
]);

export default eslintConfig;
