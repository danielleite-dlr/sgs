# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@9

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
EXPOSE 3000
CMD ["pnpm", "dev"]

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm prisma generate

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/main"]
