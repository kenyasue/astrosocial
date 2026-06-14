# AstroSocial application image.
FROM node:24-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source and migrations.
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000 \
    OPENMEOW_DB_PATH=/app/data/openmeow.db \
    OPENMEOW_MIGRATIONS_DIR=/app/migrations

EXPOSE 3000

# Persisted volumes: SQLite database and uploaded media.
VOLUME ["/app/data", "/app/uploads"]

ENTRYPOINT ["./docker/entrypoint.sh"]
