-- TASK-053 targeted smoke checks for local Supabase.
-- Keyless membership/invitation: accept completes as membership transaction,
-- role/revoke propagate via authority revision, revoked users lose row and
-- Realtime access, and no key provisioning artifacts are created.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task053_membership_invitation.sql

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task053-owner@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task053-member@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000533', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task053-viewer@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task053-intruder@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, email, nickname) VALUES
  ('00000000-0000-0000-0000-000000000531', 'task053-owner@onvoy.local', 'owner'),
  ('00000000-0000-0000-0000-000000000532', 'task053-member@onvoy.local', 'member'),
  ('00000000-0000-0000-0000-000000000533', 'task053-viewer@onvoy.local', 'viewer'),
  ('00000000-0000-0000-0000-000000000534', 'task053-intruder@onvoy.local', 'intruder')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, nickname = EXCLUDED.nickname;

-- Owner creates a trip through the command RPC (bootstraps documents +
-- owner membership) and issues a targeted invitation plus a viewer invite.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000531';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000531","email":"task053-owner@onvoy.local"}';

CREATE TEMP TABLE task053_state (
  key text PRIMARY KEY,
  value text
) ON COMMIT DROP;

DO $$
DECLARE
  result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '53000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '53000000-0000-0000-0000-000000000011',
        'entity_type', 'trip',
        'entity_id', '53000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'destination', '속초',
          'start_date', '2026-08-01',
          'end_date', '2026-08-03',
          'adults_count', 2,
          'children_count', 0
        )
      )
    ),
    0
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'Expected trip create revision 1, got %', result;
  END IF;

  result := public.create_document_invitation_link(
    '53000000-0000-0000-0000-000000000001',
    'editor',
    NULL,
    1,
    'task053-member@onvoy.local',
    '속초',
    '2026-08-01',
    '2026-08-03'
  );
  IF result ->> 'token' IS NULL THEN
    RAISE EXCEPTION 'Expected targeted invitation token, got %', result;
  END IF;
  INSERT INTO task053_state (key, value) VALUES ('member_token', result ->> 'token');

  result := public.create_document_invitation_link(
    '53000000-0000-0000-0000-000000000001',
    'viewer',
    NULL,
    1,
    'task053-viewer@onvoy.local',
    NULL,
    NULL,
    NULL
  );
  INSERT INTO task053_state (key, value) VALUES ('viewer_token', result ->> 'token');
END;
$$;

-- A logged-in account with a different email cannot accept the targeted invitation.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000534';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000534","email":"task053-intruder@onvoy.local"}';

DO $$
DECLARE
  invite_token text;
BEGIN
  SELECT value INTO invite_token FROM task053_state WHERE key = 'member_token';
  BEGIN
    PERFORM public.accept_document_invitation(invite_token, NULL);
    RAISE EXCEPTION 'Expected targeted invitation acceptance to fail for mismatched email';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%다른 계정%' THEN
        RAISE EXCEPTION 'Unexpected acceptance error: %', SQLERRM;
      END IF;
  END;
END;
$$;

-- The invited account accepts: membership becomes the completion condition,
-- the authority revision bumps, and no key provisioning artifacts appear.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000532';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000532","email":"task053-member@onvoy.local"}';

DO $$
DECLARE
  invite_token text;
  result jsonb;
  revision bigint;
BEGIN
  SELECT value INTO invite_token FROM task053_state WHERE key = 'member_token';
  result := public.accept_document_invitation(invite_token, NULL);
  IF result ->> 'status' <> 'accepted' OR (result ->> 'requires_key_provisioning')::boolean THEN
    RAISE EXCEPTION 'Expected keyless accepted membership, got %', result;
  END IF;

  revision := public.get_trip_authority_revision('53000000-0000-0000-0000-000000000001');
  IF revision <> 2 THEN
    RAISE EXCEPTION 'Expected membership accept to bump revision to 2, got %', revision;
  END IF;

  -- Accepted member reads the canonical bundle immediately.
  result := public.get_trip_authority_bundle('53000000-0000-0000-0000-000000000001');
  IF result -> 'trip' ->> 'destination' <> '속초' THEN
    RAISE EXCEPTION 'Expected canonical bundle read after accept, got %', result;
  END IF;

  -- Editor role writes rows.
  result := public.apply_trip_commands(
    '53000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '53000000-0000-0000-0000-000000000021',
        'entity_type', 'plan',
        'entity_id', '53000000-0000-0000-0000-000000000002',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '해변 산책',
          'start_datetime_local', '2026-08-01 10:00:00',
          'end_datetime_local', '2026-08-01 11:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )
    ),
    2
  );
  IF result ->> 'status' <> 'applied' THEN
    RAISE EXCEPTION 'Expected editor write to apply, got %', result;
  END IF;
END;
$$;

-- Viewer accepts and can read but not write.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000533';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000533","email":"task053-viewer@onvoy.local"}';

DO $$
DECLARE
  invite_token text;
  result jsonb;
BEGIN
  SELECT value INTO invite_token FROM task053_state WHERE key = 'viewer_token';
  result := public.accept_document_invitation(invite_token, NULL);
  IF result ->> 'role' <> 'viewer' THEN
    RAISE EXCEPTION 'Expected viewer membership, got %', result;
  END IF;

  result := public.get_trip_authority_bundle('53000000-0000-0000-0000-000000000001');
  IF result -> 'trip' ->> 'destination' <> '속초' THEN
    RAISE EXCEPTION 'Expected viewer bundle read, got %', result;
  END IF;

  BEGIN
    PERFORM public.apply_trip_commands(
      '53000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'operation_id', '53000000-0000-0000-0000-000000000031',
          'entity_type', 'plan',
          'entity_id', '53000000-0000-0000-0000-000000000003',
          'action', 'upsert',
          'payload', jsonb_build_object(
            'title', '금지된 일정',
            'start_datetime_local', '2026-08-02 10:00:00',
            'end_datetime_local', '2026-08-02 11:00:00',
            'timezone_string', 'Asia/Seoul'
          )
        )
      ),
      3
    );
    RAISE EXCEPTION 'Expected viewer write to be forbidden';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- Membership writes bypassing the RPCs stay blocked by table grants/RLS.
  BEGIN
    UPDATE public.document_members
      SET role = 'owner'
      WHERE document_id = '53000000-0000-0000-0000-000000000001'
        AND user_id = auth.uid();
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.document_members
    WHERE document_id = '53000000-0000-0000-0000-000000000001'
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Expected direct document_members update to be blocked';
  END IF;
END;
$$;

-- Owner promotes the viewer to editor and revokes the first member.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000531';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000531","email":"task053-owner@onvoy.local"}';

DO $$
DECLARE
  viewer_member_id uuid;
  member_member_id uuid;
  result jsonb;
  revision_before bigint;
  revision_after bigint;
BEGIN
  SELECT id INTO viewer_member_id
  FROM public.document_members
  WHERE document_id = '53000000-0000-0000-0000-000000000001'
    AND user_id = '00000000-0000-0000-0000-000000000533';
  SELECT id INTO member_member_id
  FROM public.document_members
  WHERE document_id = '53000000-0000-0000-0000-000000000001'
    AND user_id = '00000000-0000-0000-0000-000000000532';

  revision_before := public.get_trip_authority_revision('53000000-0000-0000-0000-000000000001');

  PERFORM public.set_document_member_role(viewer_member_id, 'editor');
  revision_after := public.get_trip_authority_revision('53000000-0000-0000-0000-000000000001');
  IF revision_after <> revision_before + 1 THEN
    RAISE EXCEPTION 'Expected role change to bump revision, got % -> %', revision_before, revision_after;
  END IF;

  result := public.revoke_document_member(member_member_id);
  IF result ->> 'user_id' <> '00000000-0000-0000-0000-000000000532' THEN
    RAISE EXCEPTION 'Expected revoked member payload, got %', result;
  END IF;
  IF public.get_trip_authority_revision('53000000-0000-0000-0000-000000000001') <> revision_after + 1 THEN
    RAISE EXCEPTION 'Expected revoke to bump revision';
  END IF;
END;
$$;

-- Promoted viewer now writes rows.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000533';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000533","email":"task053-viewer@onvoy.local"}';

DO $$
DECLARE
  result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '53000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '53000000-0000-0000-0000-000000000041',
        'entity_type', 'plan',
        'entity_id', '53000000-0000-0000-0000-000000000004',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '허용된 일정',
          'start_datetime_local', '2026-08-02 14:00:00',
          'end_datetime_local', '2026-08-02 15:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )
    ),
    public.get_trip_authority_revision('53000000-0000-0000-0000-000000000001')
  );
  IF result ->> 'status' <> 'applied' THEN
    RAISE EXCEPTION 'Expected promoted editor write to apply, got %', result;
  END IF;
END;
$$;

-- Revoked member loses row reads, stale offline writes, and the Realtime topic.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000532';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000532","email":"task053-member@onvoy.local"}';

DO $$
BEGIN
  BEGIN
    PERFORM public.get_trip_authority_bundle('53000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Expected revoked bundle read to be forbidden';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.apply_trip_commands(
      '53000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'operation_id', '53000000-0000-0000-0000-000000000051',
          'entity_type', 'plan',
          'entity_id', '53000000-0000-0000-0000-000000000005',
          'action', 'upsert',
          'payload', jsonb_build_object(
            'title', '늦은 오프라인 일정',
            'start_datetime_local', '2026-08-03 10:00:00',
            'end_datetime_local', '2026-08-03 11:00:00',
            'timezone_string', 'Asia/Seoul'
          )
        )
      ),
      2
    );
    RAISE EXCEPTION 'Expected revoked offline command to be rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  IF public.can_receive_authority_topic(
    'trip:53000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000532'
  ) THEN
    RAISE EXCEPTION 'Expected revoked member to lose Realtime topic access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.list_my_trip_authority_summaries()) summary
    WHERE summary ->> 'resource_id' = '53000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Expected revoked member summaries to exclude the trip';
  END IF;
END;
$$;

RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;

SELECT 'task053_membership_invitation checks passed' AS result;

ROLLBACK;
