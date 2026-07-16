-- TASK-049 targeted smoke checks for local Supabase.
-- Run after TASK-046 and TASK-049 migrations.

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000491', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task049-owner@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000492', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task049-viewer@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000493', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task049-outsider@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000491';
SELECT public.apply_trip_commands(
  '49000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object(
    'operation_id', '49000000-0000-0000-0000-000000000011',
    'entity_type', 'trip',
    'entity_id', '49000000-0000-0000-0000-000000000001',
    'action', 'upsert',
    'payload', jsonb_build_object(
      'destination', '부산',
      'start_date', '2026-08-01',
      'end_date', '2026-08-03'
    )
  )),
  0
);

RESET ROLE;
INSERT INTO public.document_members (document_id, user_id, role, status)
VALUES (
  '49000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000492',
  'viewer',
  'accepted'
);

DO $$
DECLARE
  message realtime.messages%ROWTYPE;
BEGIN
  SELECT * INTO message
  FROM realtime.messages
  WHERE topic = 'trip:49000000-0000-0000-0000-000000000001'
    AND event = 'authority_changed'
  ORDER BY inserted_at DESC
  LIMIT 1;

  IF message.id IS NULL
    OR message.private IS DISTINCT FROM true
    OR message.payload ->> 'resource_type' <> 'trip'
    OR (message.payload ->> 'revision')::bigint <> 1
    OR (message.payload ->> 'change_count')::integer <> 1 THEN
    RAISE EXCEPTION 'Expected private trip revision invalidation, got %', message;
  END IF;

  IF octet_length(message.payload::text) >= 1024 THEN
    RAISE EXCEPTION 'Invalidation payload exceeds 1KB: %', octet_length(message.payload::text);
  END IF;

  IF NOT public.can_receive_authority_topic(
    message.topic,
    '00000000-0000-0000-0000-000000000492'
  ) THEN
    RAISE EXCEPTION 'Expected accepted viewer to receive invalidation';
  END IF;

  IF public.can_receive_authority_topic(
    message.topic,
    '00000000-0000-0000-0000-000000000493'
  ) THEN
    RAISE EXCEPTION 'Expected outsider to be denied invalidation';
  END IF;
END $$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000492';
SET realtime.topic = 'trip:49000000-0000-0000-0000-000000000001';

DO $$
DECLARE visible_messages integer;
BEGIN
  SELECT count(*) INTO visible_messages
  FROM realtime.messages
  WHERE topic = 'trip:49000000-0000-0000-0000-000000000001'
    AND event = 'authority_changed';
  IF visible_messages < 1 THEN
    RAISE EXCEPTION 'Expected viewer RLS to expose the authority invalidation';
  END IF;
END $$;

RESET ROLE;
UPDATE public.document_members
SET status = 'revoked'
WHERE document_id = '49000000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000492';

DO $$
BEGIN
  IF public.can_receive_authority_topic(
    'trip:49000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000492'
  ) THEN
    RAISE EXCEPTION 'Expected revoked viewer to be denied invalidations';
  END IF;
END $$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000493';
DO $$
DECLARE visible_messages integer;
BEGIN
  SELECT count(*) INTO visible_messages
  FROM realtime.messages
  WHERE topic = 'trip:49000000-0000-0000-0000-000000000001'
    AND event = 'authority_changed';
  IF visible_messages <> 0 THEN
    RAISE EXCEPTION 'Expected outsider RLS to hide authority invalidations';
  END IF;
END $$;

RESET ROLE;
SELECT 'task049_realtime_invalidation_checks_passed' AS result;
ROLLBACK;
