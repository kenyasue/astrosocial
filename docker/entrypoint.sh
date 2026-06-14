#!/usr/bin/env sh
# Startup sequence: create data dirs, run migrations, then start the server.
# A failed migration aborts startup (set -e) so we never serve a half-migrated DB.
set -e

DATA_DIR="$(dirname "${OPENMEOW_DB_PATH:-/app/data/openmeow.db}")"
mkdir -p "$DATA_DIR" /app/uploads

echo "Running database migrations..."
npm run migrate

echo "Starting AstroSocial..."
exec npm run start
