#!/bin/sh
set -e

echo "[zhimu-api] running migrations…"
node scripts/migrate.js

if [ "${RUN_PLATFORM_CATALOG_SEED:-false}" = "true" ]; then
  echo "[zhimu-api] RUN_PLATFORM_CATALOG_SEED=true — legacy platform demo seed…"
  node scripts/ensure-platform-catalog.js
fi

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[zhimu-api] RUN_DB_SEED=true: full seed pass…"
  node scripts/seed.js
  node scripts/seed-exploration.js 2>/dev/null || true
fi

echo "[zhimu-api] starting server on :${PORT:-4180}…"
exec node src/server.js
