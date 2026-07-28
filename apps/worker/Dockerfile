# Build context is the monorepo root: docker build -f apps/worker/Dockerfile .
FROM node:20-slim AS base
# Prisma's query engine needs libssl, which node:20-slim doesn't ship — without this, Prisma
# guesses an OpenSSL version at `generate` time and may silently pick wrong, only failing at
# actual runtime when the engine binary can't load. Installed once here so both the installer
# stage (generate) and runner stage (actual queries) have it.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2
COPY . .
RUN turbo prune @therapy-docs/worker --docker

FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm@9.15.0
COPY --from=pruner /app/out/json/ .
# esbuild bundles @therapy-docs/* workspace source inline but leaves every real npm dependency
# external (require("@prisma/client") etc. survive verbatim in the final bundle) — once bundled,
# those requires resolve relative to apps/worker/dist/, not wherever the original workspace
# package (e.g. packages/db) lived. pnpm's default strict/isolated node_modules only symlinks a
# package's dependencies into *that package's own* node_modules, so e.g. @prisma/client (a
# dependency of packages/db, not apps/worker) is unreachable from the bundle's resolution path
# (confirmed: "Cannot find module '@prisma/client'" with the default linker). Hoisted linking —
# scoped to this Docker build only, not the repo's actual .npmrc/local dev — puts every
# dependency in one flat root node_modules, reachable from anywhere.
RUN echo "node-linker=hoisted" >> .npmrc
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Regenerates Prisma's client with a Linux query engine — a client generated on the dev
# machine's OS (macOS/Windows) won't run in this container.
RUN pnpm --filter @therapy-docs/db run generate
RUN pnpm turbo run build --filter=@therapy-docs/worker...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# esbuild (build.mjs) only bundles @therapy-docs/* workspace source inline (see
# apps/worker/README.md) — every real npm dependency (Prisma client, Google Cloud SDKs, etc.) is
# deliberately left external and still needs real node_modules at runtime. pnpm uses per-package
# node_modules symlink folders into a shared store, not one flat root folder — copying only
# apps/worker/dist + a single node_modules dir misses those symlinks (confirmed: "Cannot find
# module 'express'" when only the root node_modules was copied). Copying the whole installer
# stage output keeps the entire resolved pnpm workspace intact, at the cost of a larger image.
COPY --from=installer /app ./

EXPOSE 8081
ENV WORKER_PORT=8081
# Same Prisma-vs-bundler fix as apps/api/Dockerfile: its generated client's __dirname-based
# engine lookup resolves wrong once bundled, so point PRISMA_QUERY_ENGINE_LIBRARY at the real
# file directly, found dynamically at container start (not tied to one CPU architecture).
CMD ["sh", "-c", "export PRISMA_QUERY_ENGINE_LIBRARY=$(find /app/node_modules/.prisma/client -name 'libquery_engine-*.so.node' | head -1) && exec node apps/worker/dist/main.js"]
