# syntax=docker/dockerfile:1.7
# ---------- Stage 1: install ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential ca-certificates && rm -rf /var/lib/apt/lists/*
COPY server/package.json ./
RUN npm install --no-audit --no-fund

# ---------- Stage 2: build ----------
FROM deps AS build
WORKDIR /app
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build
# Copy schema next to compiled JS so db.ts can find it
RUN cp src/schema.sql dist/schema.sql

# ---------- Stage 3: runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# better-sqlite3 needs libstdc++ (already present in bookworm-slim)
RUN groupadd -r app && useradd -r -g app app && \
    mkdir -p /data/uploads && chown -R app:app /data

COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist

USER app
VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
