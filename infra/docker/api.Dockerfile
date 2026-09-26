# VOP API image — multi-stage, non-root, distroless runtime.
# Build context is the monorepo root (see docker-compose build.context: ../..).

# ---- builder ----
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Prisma needs openssl at build time to fetch/generate the engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install with the whole workspace manifest set for good layer caching.
COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --no-frozen-lockfile

# Copy sources and build shared → config → api (topological).
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @vop/shared build \
  && pnpm --filter @vop/config build \
  && pnpm --filter @vop/api exec prisma generate \
  && pnpm --filter @vop/api build

# Produce a self-contained production bundle for the api (injects workspace deps).
RUN pnpm --filter=@vop/api --prod deploy /prod/api

# ---- runtime ----
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nonroot:nonroot /prod/api ./
EXPOSE 3000
# distroless nodejs image's entrypoint is `node`.
CMD ["dist/main.js"]
