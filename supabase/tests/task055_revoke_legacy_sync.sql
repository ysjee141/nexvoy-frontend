-- TASK-055 revoke-first smoke checks.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task055_revoke_legacy_sync.sql

BEGIN;

DO $$
DECLARE
  function_definition text;
BEGIN
  IF has_table_privilege('authenticated', 'public.document_updates', 'SELECT')
    OR has_table_privilege('authenticated', 'public.document_updates', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated must not access document_updates';
  END IF;

  IF has_table_privilege('authenticated', 'public.document_keys', 'SELECT')
    OR has_table_privilege('authenticated', 'public.document_key_provisioning_requests', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must not access legacy key tables';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.get_my_active_document_key(uuid,text,integer)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.issue_document_signaling_room_topic(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must not execute legacy key/signaling RPCs';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.apply_trip_commands(uuid,jsonb,bigint)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.accept_document_invitation(text,text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.revoke_document_member(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'canonical authority/membership RPC grants must remain';
  END IF;

  SELECT pg_get_functiondef('public.revoke_document_member(uuid)'::regprocedure)
  INTO function_definition;
  IF function_definition LIKE '%document_keys%'
    OR function_definition LIKE '%document_key_provisioning_requests%' THEN
    RAISE EXCEPTION 'member revocation still mutates legacy key state';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname LIKE '%signaling%'
  ) THEN
    RAISE EXCEPTION 'legacy signaling Realtime policies still exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'authority readers can receive revision invalidations'
      AND cmd = 'SELECT'
      AND qual LIKE '%extension%broadcast%'
      AND qual NOT LIKE '%event%'
  ) THEN
    RAISE EXCEPTION 'authority Broadcast read policy must authorize channel probes';
  END IF;
END;
$$;

ROLLBACK;
