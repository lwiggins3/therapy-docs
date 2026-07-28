const nodeExternals = require("webpack-node-externals");

/**
 * @therapy-docs/* workspace packages ship TypeScript source with no build step of their own
 * (package.json "main" points straight at src/index.ts) — fine for Next.js/Vitest/tsx, which
 * all do their own resolution/transpilation, but NestJS's default build is plain tsc with no
 * bundling, so multi-file workspace packages (relative imports like `./adapters/claude-vertex`)
 * can't be resolved by plain `node dist/main.js` at runtime. Nest's webpack build mode fixes
 * this — ts-loader still does real type-checking (so `emitDecoratorMetadata`/DI keeps working,
 * unlike an esbuild-only bundle) while webpack inlines and compiles the workspace TS source.
 * Every other (real npm) dependency stays external as normal.
 */
module.exports = (options) => ({
  ...options,
  externals: [nodeExternals({ allowlist: [/^@therapy-docs\//] })],
});
