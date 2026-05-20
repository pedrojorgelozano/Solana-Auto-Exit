# =============================================================================
# solana-auto-exit · backend image
# =============================================================================
# Build:  docker build -t solana-auto-exit:latest .
# Run:    docker compose up
#
# Diseñado para uso local (cada usuario corre su instancia). El puerto se
# bindea a 127.0.0.1 del host vía docker-compose.yml, no a 0.0.0.0.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps — instala dependencias y compila el binding nativo de
# better-sqlite3 con las build tools de Alpine.
# -----------------------------------------------------------------------------
FROM node:24-alpine AS deps

# Build tools para better-sqlite3 (node-gyp compila C++ → .node).
RUN apk add --no-cache python3 make g++

WORKDIR /app

# pnpm vía npm global (versión fijada para consistencia con el lockfile local).
RUN npm install -g pnpm@11.1.3

# Copiamos los manifests primero para aprovechar el cache de capas de Docker:
# si solo cambia el código y no las deps, este step se reusa.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/cli/package.json ./packages/cli/package.json
COPY packages/server/package.json ./packages/server/package.json

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: runtime — imagen final con node_modules de deps + código fuente.
# Las migraciones de Drizzle (packages/server/drizzle/) viajan dentro porque
# son SQL plano y el server las aplica al arrancar.
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# libstdc++ es el runtime del binding nativo de better-sqlite3.
RUN apk add --no-cache libstdc++

WORKDIR /app

RUN npm install -g pnpm@11.1.3

# Traemos node_modules ya instalados con el binding nativo compilado.
COPY --from=deps /app /app

# Copiamos el código fuente. El .dockerignore excluye node_modules y data,
# así que las deps de la fase anterior no se pisan.
COPY . .

# El server escucha aquí dentro; el host mapea via docker-compose.
EXPOSE 7777

# Defaults sensatos. SERVER_HOST=0.0.0.0 porque dentro del contenedor
# debemos aceptar conexiones de la red del contenedor; la restricción a
# localhost real la hace el port binding del compose (127.0.0.1:7777:7777).
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=7777
ENV DB_PATH=/app/data/auto-exit.db
ENV WALLET_VAULT_PATH=/app/data/wallet.vault
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@solana-auto-exit/server", "start"]
