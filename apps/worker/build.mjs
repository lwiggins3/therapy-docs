import { build } from "esbuild";

/**
 * apps/api (Nest/webpack) and apps/web (Next.js) both bundle their own workspace TS
 * dependencies as part of their normal build. apps/worker has no such bundler, and its
 * package.json@main-based workspace deps (e.g. @therapy-docs/llm-client) point straight at
 * TypeScript source with no build step of their own — plain `node dist/main.js` can't resolve
 * those at runtime. This bundles @therapy-docs/* source in, while leaving every real npm
 * dependency (Prisma, Google Cloud clients, etc.) external so their native bindings/dynamic
 * requires keep working normally.
 */
const externalizeExceptWorkspacePackages = {
  name: "externalize-except-workspace-packages",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith("@therapy-docs/")) {
        return undefined; // let esbuild bundle+compile our own workspace packages
      }
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "dist/main.js",
  sourcemap: true,
  logLevel: "info",
  plugins: [externalizeExceptWorkspacePackages],
});
