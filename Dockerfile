# =============================================================================
# solana-auto-exit · imagen self-hosted (server + web)
# =============================================================================
# Build:  docker compose build
# Run:    docker compose up
#
# Una sola imagen; docker-compose levanta dos servicios desde ella:
#   - server  → la API en :7777
#   - web     → la interfaz Next.js en :3000 (se accede por navegador)
#
# Diseñado para uso local (cada usuario corre su instancia). Los puertos se
# bindean a 127.0.0.1 del host vía docker-compose.yml, no a 0.0.0.0.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps — instala dependencias y compila los bindings nativos
# (better-sqlite3, sharp) con las build tools de Alpine.
# -----------------------------------------------------------------------------
FROM node:24-alpine AS deps

# Build tools para los módulos nativos (better-sqlite3, sharp → node-gyp).
RUN apk add --no-cache python3 make g++

WORKDIR /app

# pnpm vía npm global (versión fijada para consistencia con el lockfile local).
RUN npm install -g pnpm@11.1.3

# Copiamos los manifests primero para aprovechar el cache de capas de Docker:
# si solo cambia el código y no las deps, este step se reusa.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `pnpm-workspace.yaml` declara `patchedDependencies` → pnpm necesita la
# carpeta `patches/` presente durante el install.
COPY patches ./patches/
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/cli/package.json ./packages/cli/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: runtime — imagen final con node_modules de deps + código fuente +
# la web ya compilada (Next.js en modo server, NO static export).
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# libstdc++ es el runtime del binding nativo de better-sqlite3.
RUN apk add --no-cache libstdc++

WORKDIR /app

RUN npm install -g pnpm@11.1.3

# Telemetría de Next.js desactivada — aplica al `next build` de abajo y al
# `next start` en runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Traemos node_modules ya instalados con los bindings nativos compilados.
COPY --from=deps /app /app

# Copiamos el código fuente. El .dockerignore excluye node_modules, data y
# artefactos de build, así que las deps de la fase anterior no se pisan.
COPY . .

# Compilamos la web. Sin TAURI_BUILD → Next.js en modo server (no static
# export); el `next start` del compose la sirve.
RUN pnpm --filter @solana-auto-exit/web build

# server → 7777, web → 3000. El host mapea ambos vía docker-compose.
EXPOSE 7777 3000

# Defaults sensatos. SERVER_HOST=0.0.0.0 porque dentro del contenedor debemos
# aceptar conexiones de la red del contenedor; la restricción a localhost real
# la hace el port binding del compose (127.0.0.1:<puerto>:<puerto>).
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=7777
ENV DB_PATH=/app/data/auto-exit.db
ENV WALLET_VAULT_PATH=/app/data/wallet.vault
ENV NODE_ENV=production

# CMD por defecto = el server. El servicio `web` del compose sobreescribe el
# command para arrancar Next.
CMD ["pnpm", "--filter", "@solana-auto-exit/server", "start"]
