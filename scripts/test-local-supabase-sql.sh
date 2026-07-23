#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${SUPABASE_DB_CONTAINER:-supabase_db_travel-pack}"

if ! docker inspect "$container_name" >/dev/null 2>&1; then
  echo "Local Supabase database container is not running: $container_name" >&2
  exit 1
fi

for sql_file in supabase/tests/*.sql; do
  echo "Running $sql_file"
  docker exec -i "$container_name" \
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$sql_file"
done
