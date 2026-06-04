#!/bin/sh
set -e

echo "[zhimu-api] running migrations…"
node scripts/migrate.js

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[zhimu-api] seeding database (RUN_DB_SEED=true)…"
  node scripts/seed.js
  node scripts/seed-exploration.js 2>/dev/null || true
fi

echo "[zhimu-api] starting server on :${PORT:-4180}…"
exec node src/server.js
