# VOP Web image — Next.js standalone, non-root, distroless runtime.
# Build context is the monorepo root (see docker-compose build.context: ../..).

# ---- builder ----
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --no-frozen-lockfile

COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @vop/shared build \
  && pnpm --filter @vop/web build

# ---- runtime ----
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone output already contains the minimal server + pruned node_modules.
COPY --from=builder --chown=nonroot:nonroot /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nonroot:nonroot /app/apps/web/public ./apps/web/public

EXPOSE 3001
CMD ["apps/web/server.js"]
