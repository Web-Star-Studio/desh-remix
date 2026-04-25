import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Minimal flat config shared by apps/api, packages/shared, packages/database.
// apps/web has its own React-flavored config and ignores this one.
export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/migrations/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
