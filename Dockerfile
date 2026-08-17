# Совёнок — сборка и запуск на собственном сервере.
#
# Приложение изначально писалось под Cloudflare Workers + D1, но выкладывается
# только на свой сервер: в Cloudflare оно больше не деплоится нигде, и конфигов
# для этого в репозитории нет. Чтобы не переписывать слой доступа к данным,
# worker-бандл исполняется в workerd через miniflare — тот же рантайм, что
# стоит за Workers, но целиком локальный. Данные при этом лежат в PostgreSQL
# (см. db-gateway ниже); локальный D1 поверх SQLite остаётся путём отката.
# Статика раздаётся Caddy: он отдаёт файл из dist/client, если тот есть, а всё
# остальное (включая "/") проксирует в SSR-worker — схема "asset-first",
# описанная в deploy/Caddyfile.

# ── сборка ────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /src

# Зависимости отдельным слоем: воркспейсы packages/* нужны уже на install.
COPY app/package.json app/bun.lock app/bunfig.toml ./
COPY app/packages ./packages
RUN bun install --frozen-lockfile

COPY app/ ./
# Юридические тексты лежат вне app/, а страница /oferta импортирует свой
# исходник как есть (?raw) — второй копии оферты в проекте быть не должно.
# app/ распакован в /src, поэтому соседний с ним docs/ ложится в /docs:
# путь `../../../docs` из src/routes/oferta.tsx сходится и здесь, и локально.
COPY docs /docs
# Только vite build: скрипт "build" из package.json параллельно гоняет tsc,
# для образа нужен артефакт, а не тайпчек (он живёт в CI).
RUN bunx vite build

# ── SSR-worker ────────────────────────────────────────────────────────────
FROM node:22-slim AS app
WORKDIR /srv
ENV NODE_ENV=production
COPY deploy/runtime.package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /src/dist/server ./dist/server
COPY --from=build /src/migrations ./migrations
COPY deploy/serve.mjs ./serve.mjs
ENV PORT=8080 D1_PERSIST=/data/d1
EXPOSE 8080
CMD ["node", "serve.mjs"]

# ── шлюз к PostgreSQL ─────────────────────────────────────────────────────
# Не зависит от стадии build: воркеру он нужен только по сети.
FROM node:22-slim AS db-gateway
WORKDIR /srv
ENV NODE_ENV=production
COPY deploy/db-gateway/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
# Те же миграции, что и у D1: схема оказалась переносимой без правок.
COPY app/migrations ./migrations
COPY deploy/db-gateway/server.mjs ./server.mjs
ENV PORT=8787 MIGRATIONS_DIR=/srv/migrations
EXPOSE 8787
CMD ["node", "server.mjs"]

# ── статика + TLS + reverse proxy ─────────────────────────────────────────
FROM caddy:2-alpine AS web
COPY --from=build /src/dist/client /srv/www
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
