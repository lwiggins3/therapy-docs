// TODO: eslint-config-next's plugin bundle (eslint-plugin-react, eslint-plugin-jsx-a11y,
// eslint-plugin-react-hooks) doesn't yet support ESLint 10 (see peer dependency warnings on
// install) — re-add `next/core-web-vitals` via @eslint/eslintrc's FlatCompat once it does:
//
//   const { FlatCompat } = require("@eslint/eslintrc");
//   const compat = new FlatCompat({ baseDirectory: __dirname });
//   module.exports = [...shared, ...compat.extends("next/core-web-vitals", "next/typescript")];
//
// Until then, apps/web lints against the same shared TS/JS rules as every other package.
module.exports = [...require("@therapy-docs/config/eslint-preset.js")];
