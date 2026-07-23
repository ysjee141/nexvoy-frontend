#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required." >&2
  exit 1
fi

eval "$(supabase status -o env)"

case "${API_URL:-}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *)
    echo "Production P0 tests require local Supabase; got ${API_URL:-unset}." >&2
    exit 1
    ;;
esac

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-e2e-dummy-key}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3001}"

pnpm --filter @nexvoy/core test
pnpm --filter nexvoy-web test:authority
pnpm --filter nexvoy-app test:authority
pnpm test:sql:local
pnpm --filter nexvoy-web test:e2e
