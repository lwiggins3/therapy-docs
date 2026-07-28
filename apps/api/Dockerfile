# Build context is the monorepo root: docker build -f apps/api/Dockerfile .
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
RUN turbo prune @therapy-docs/api --docker

FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm@9.15.0
COPY --from=pruner /app/out/json/ .
# Webpack bundles @therapy-docs/* workspace source inline but leaves every real npm dependency
# external (require("@prisma/client") etc. survive verbatim in the final bundle) — once bundled,
# those requires resolve relative to apps/api/dist/, not wherever the original workspace package
# (e.g. packages/db) lived. pnpm's default strict/isolated node_modules only symlinks a
# package's dependencies into *that package's own* node_modules, so e.g. @prisma/client (a
# dependency of packages/db, not apps/api) is unreachable from the bundle's resolution path
# (confirmed on apps/worker: "Cannot find module '@prisma/client'" with the default linker).
# Hoisted linking — scoped to this Docker build only, not the repo's actual .npmrc/local dev —
# puts every dependency in one flat root node_modules, reachable from anywhere.
RUN echo "node-linker=hoisted" >> .npmrc
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Regenerates Prisma's client with a Linux query engine — a client generated on the dev
# machine's OS (macOS/Windows) won't run in this container.
RUN pnpm --filter @therapy-docs/db run generate
RUN pnpm turbo run build --filter=@therapy-docs/api...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# NestJS's webpack build only bundles @therapy-docs/* workspace source inline (see
# apps/api/README.md) — every real npm dependency (Prisma client, etc.) is deliberately left
# external and still needs real node_modules at runtime, unlike apps/web's standalone output.
# pnpm uses per-package node_modules symlink folders into a shared store, not one flat root
# folder — copying only dist + a single node_modules dir misses those symlinks (confirmed on
# apps/worker: "Cannot find module 'express'" with that approach). Copying the whole installer
# stage output keeps the entire resolved pnpm workspace intact, at the cost of a larger image.
COPY --from=installer /app ./

EXPOSE 8080
ENV API_PORT=8080
# Prisma's generated client tries to locate its native query engine binary at runtime using an
# `eval("__dirname")` trick meant to survive bundling — but it still resolves to the wrong path
# once webpack has bundled the code, so Prisma searches everywhere except where the engine
# actually is (confirmed: PrismaClientInitializationError, "could not locate the Query Engine",
# despite the file genuinely existing under node_modules/.prisma/client). Sidestep the fragile
# search entirely by pointing PRISMA_QUERY_ENGINE_LIBRARY at it directly. Found dynamically at
# container start (not hardcoded at build time) so this isn't tied to one CPU architecture —
# `prisma generate` above always produces an engine matching whatever platform actually built
# this image, whether that's arm64 (local) or x86_64 (GitHub Actions/Cloud Build).
CMD ["sh", "-c", "export PRISMA_QUERY_ENGINE_LIBRARY=$(find /app/node_modules/.prisma/client -name 'libquery_engine-*.so.node' | head -1) && exec node apps/api/dist/main.js"]
