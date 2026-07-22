-- DEV-only destructive cleanup. Never run through `supabase db push`.
-- Usage:
--   psql "$DEV_DATABASE_URL" \
--     -v ON_ERROR_STOP=1 \
--     -v ONVOY_PROJECT_REF=ivgkqzwosbjukonlpfdw \
--     -f supabase/maintenance/task055_reset_legacy_v1_dev.sql

\if :{?ONVOY_PROJECT_REF}
\else
  \echo 'ONVOY_PROJECT_REF is required; refusing TASK-055 reset.'
  \quit
\endif

SELECT :'ONVOY_PROJECT_REF' = 'ivgkqzwosbjukonlpfdw' AS task055_confirmed_dev \gset
\if :task055_confirmed_dev
\else
  \echo 'Project ref is not OnVoy DEV; refusing TASK-055 reset.'
  \quit
\endif

BEGIN;

TRUNCATE TABLE
  public.document_updates,
  public.document_devices,
  public.legacy_row_map,
  public.document_keys,
  public.document_key_provisioning_requests,
  public.user_key_materials,
  public.document_signaling_room_topics
RESTART IDENTITY;

UPDATE public.documents
SET snapshot = NULL,
    snapshot_hash = NULL,
    encrypted = false,
    schema_version = 1
WHERE snapshot IS NOT NULL
   OR snapshot_hash IS NOT NULL
   OR encrypted IS DISTINCT FROM false;

COMMIT;
