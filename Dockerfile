# Production image for the Next.js app. Keeps full node_modules in the
# runtime stage (rather than Next's "standalone" output) so the Prisma CLI
# and its generated client are always present — simpler and more reliable
# than chasing which files a trimmed output does or doesn't externalize.
#
# Migrations are NOT run during `docker build` — the database isn't
# reachable from the build context. They run as part of the container's
# startup command instead (see CMD below), once docker-compose has brought
# Postgres up and the app container can reach it over the compose network.

FROM node:22-alpine AS base
# Commonly needed on alpine (musl libc) for native addons / Prisma; cheap
# to include defensively even if not strictly required by this setup.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# --ignore-scripts: this stage only needs node_modules for layer caching.
# `npm ci`'s postinstall runs `prisma generate`, which needs prisma/schema.prisma
# — not copied here (only package.json/lock are, so this layer only
# invalidates on dependency changes). The builder stage runs `prisma
# generate` explicitly once the full source is present.
RUN npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is unused at build time but Next.js reads process.env at
# build for anything statically evaluated; harmless placeholder is fine.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build:app

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
