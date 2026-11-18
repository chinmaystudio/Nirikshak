#!/usr/bin/env bash
# Replays every migration from zero against a plain PostgreSQL database.
# Usage: DATABASE_URL=postgres://... ./apply-migrations.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
: "${DATABASE_URL:?DATABASE_URL is required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$here/00_supabase_shim.sql"
for f in $(ls "$here/../migrations"/*.sql | sort); do
  echo "applying $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
