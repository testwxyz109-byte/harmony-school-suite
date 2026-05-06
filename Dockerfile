# syntax=docker/dockerfile:1.7
# ---------- Stage 1: install deps ----------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# ---------- Stage 2: build ----------
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build TanStack Start (outputs to .output/ for Node target)
RUN bun run build

# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built artifacts and production node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Persist uploaded files here (mount a volume in compose)
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 3000
# TanStack Start (Node target) entrypoint:
CMD ["node", ".output/server/index.mjs"]
