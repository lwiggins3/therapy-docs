# Build context is the monorepo root: docker build -f apps/web/Dockerfile .
#
# node:20-slim (Debian/glibc), not alpine, for both build and runtime — avoids musl-libc/Prisma
# binary-target friction entirely, since apps/web pulls in @therapy-docs/shared-types which is
# fine either way, but keeping one base image family across all three apps' Dockerfiles avoids
# having to think about it per-app.
FROM node:20-slim AS base

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2
COPY . .
RUN turbo prune @therapy-docs/web --docker

FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm@9.15.0
# out/json/ first: pnpm install layer-caches independently of source changes.
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

# apps/web's "build" script is dotenv-wrapped for local dev (dotenv -e ../../.env -- next build);
# an empty .env here satisfies that without needing real secrets — the actual value below is a
# real ENV var, which dotenv-cli does not override.
RUN touch .env
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo run build --filter=@therapy-docs/web...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /app/apps/web/public ./apps/web/public

EXPOSE 8080
ENV PORT=8080
CMD ["node", "apps/web/server.js"]
