const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

/**
 * Shared flat ESLint config, spread into each app/package's eslint.config.js:
 *
 *   module.exports = [...require("@therapy-docs/config/eslint-preset.js")];
 */
module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettier,
  {
    ignores: ["dist/**", ".next/**", "node_modules/**"],
  },
);
