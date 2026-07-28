# @therapy-docs/config

Shared `tsconfig` and ESLint (flat config) base, extended by every other package/app instead of
duplicating compiler/lint settings.

## Usage

**tsconfig.json:**
```json
{
  "extends": "@therapy-docs/config/tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}
```

**eslint.config.js:**
```js
module.exports = [...require("@therapy-docs/config/eslint-preset.js")];
```

Apps needing framework-specific rules (e.g. `apps/web`'s Next.js/React rules) spread the shared
preset first, then append their own — see `apps/web/eslint.config.js` for the pattern with
`eslint-config-next` bridged in via `FlatCompat`.

No build step — this package just ships config files (see `files` in `package.json`).
