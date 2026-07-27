-- TASK-059: explicit API role allowlist and identity-bound helper regression.
BEGIN;

DO $$
DECLARE
  denied_signature text;
  allowed_signature text;
BEGIN
  FOREACH denied_signature IN ARRAY ARRAY[
    'public.set_authority_row_metadata()',
    'public.apply_one_trip_authority_command(uuid,jsonb,uuid)',
    'public.apply_one_template_authority_command(uuid,jsonb,uuid)',
    'public.apply_trip_authority_commands(uuid,jsonb,bigint)',
    'public.apply_template_authority_commands(uuid,jsonb,bigint)',
    'public.trip_authority_stale_batch_is_rebasable(uuid,jsonb)',
    'public.template_authority_stale_batch_is_rebasable(uuid,jsonb)',
    'public.broadcast_authority_state_invalidation()',
    'public.bump_authority_revision_for_membership(uuid)',
    'public.assert_targeted_invitation_recipient(uuid)',
    'public.accept_document_invitation_unchecked(text,text)',
    'public.create_document_invitation_link_legacy(uuid,text,timestamp with time zone,integer)',
    'public.list_orphan_place_photo_assets(interval)'
  ]
  LOOP
    IF has_function_privilege('anon', denied_signature, 'EXECUTE')
      OR has_function_privilege('authenticated', denied_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Internal function remains exposed: %', denied_signature;
    END IF;
    IF NOT has_function_privilege('service_role', denied_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Service role cannot execute internal function: %', denied_signature;
    END IF;
  END LOOP;

  FOREACH allowed_signature IN ARRAY ARRAY[
    'public.bootstrap_owner_document(uuid,text,integer)',
    'public.create_document_invitation_link(uuid,text,timestamp with time zone,integer,text,text,date,date)',
    'public.accept_document_invitation(text,text)',
    'public.list_my_pending_document_invitations()',
    'public.accept_my_document_invitation(uuid)',
    'public.decline_my_document_invitation(uuid)',
    'public.list_document_collaborators(uuid)',
    'public.list_document_pending_invitations(uuid)',
    'public.set_document_member_role(uuid,text)',
    'public.revoke_document_member(uuid)',
    'public.get_trip_authority_revision(uuid)',
    'public.get_template_authority_revision(uuid)',
    'public.get_trip_authority_bundle(uuid)',
    'public.get_template_authority_bundle(uuid)',
    'public.get_trip_authority_changes(uuid,jsonb,bigint)',
    'public.get_template_authority_changes(uuid,jsonb,bigint)',
    'public.list_my_trip_authority_summaries()',
    'public.list_my_template_authority_summaries()',
    'public.apply_trip_commands(uuid,jsonb,bigint)',
    'public.apply_template_commands(uuid,jsonb,bigint)',
    'public.can_receive_authority_topic(text,uuid)',
    'public.check_can_write_place_photo_object(text,uuid)',
    'public.register_place_photo_asset(uuid,uuid,text,integer,text)'
  ]
  LOOP
    IF has_function_privilege('anon', allowed_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated RPC remains exposed to anon: %', allowed_signature;
    END IF;
    IF NOT has_function_privilege('authenticated', allowed_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated RPC is unavailable: %', allowed_signature;
    END IF;
  END LOOP;

  IF NOT has_function_privilege(
    'anon',
    'public.get_document_invitation_summary(text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Invitation summary must remain available before login';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    'public.check_can_read_authority_trip(uuid,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.check_can_write_authority_trip(uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authority RLS helper role split is invalid';
  END IF;
END;
$$;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000591',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'task059-owner-a@onvoy.local',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000592',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'task059-owner-b@onvoy.local',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

INSERT INTO public.profiles (id, email, nickname)
VALUES
  (
    '00000000-0000-0000-0000-000000000591',
    'task059-owner-a@onvoy.local',
    'TASK-059 A'
  ),
  (
    '00000000-0000-0000-0000-000000000592',
    'task059-owner-b@onvoy.local',
    'TASK-059 B'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.documents (id, owner_id, type, schema_version)
VALUES
  (
    '00000000-0000-0000-0000-000000005591',
    '00000000-0000-0000-0000-000000000591',
    'trip',
    1
  ),
  (
    '00000000-0000-0000-0000-000000005592',
    '00000000-0000-0000-0000-000000000592',
    'trip',
    1
  );

INSERT INTO public.document_members (
  document_id, user_id, role, status
) VALUES
  (
    '00000000-0000-0000-0000-000000005591',
    '00000000-0000-0000-0000-000000000591',
    'owner',
    'accepted'
  ),
  (
    '00000000-0000-0000-0000-000000005592',
    '00000000-0000-0000-0000-000000000592',
    'owner',
    'accepted'
  );

INSERT INTO public.trips (
  id, user_id, destination, start_date, end_date
) VALUES
  (
    '00000000-0000-0000-0000-000000005591',
    '00000000-0000-0000-0000-000000000591',
    'TASK-059 A',
    current_date,
    current_date + 1
  ),
  (
    '00000000-0000-0000-0000-000000005592',
    '00000000-0000-0000-0000-000000000592',
    'TASK-059 B',
    current_date,
    current_date + 1
  );

INSERT INTO public.trip_authority_state (trip_id, revision)
VALUES
  ('00000000-0000-0000-0000-000000005591', 1),
  ('00000000-0000-0000-0000-000000005592', 1);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000591","role":"authenticated","email":"task059-owner-a@onvoy.local"}',
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000591',
  true
);

DO $$
BEGIN
  IF NOT public.check_can_write_authority_trip(
    '00000000-0000-0000-0000-000000005591',
    '00000000-0000-0000-0000-000000000591'
  ) THEN
    RAISE EXCEPTION 'Caller lost write authority for its own trip';
  END IF;

  IF public.check_can_write_authority_trip(
    '00000000-0000-0000-0000-000000005592',
    '00000000-0000-0000-0000-000000000592'
  ) THEN
    RAISE EXCEPTION 'Caller can probe another user write authority';
  END IF;

  IF public.check_can_read_authority_trip(
    '00000000-0000-0000-0000-000000005592',
    '00000000-0000-0000-0000-000000000592'
  ) THEN
    RAISE EXCEPTION 'Caller can probe another user read authority';
  END IF;

  IF public.can_receive_authority_topic(
    'trip:00000000-0000-0000-0000-000000005592',
    '00000000-0000-0000-0000-000000000592'
  ) THEN
    RAISE EXCEPTION 'Caller can probe another user Realtime authority';
  END IF;

  BEGIN
    PERFORM public.apply_one_trip_authority_command(
      '00000000-0000-0000-0000-000000005592',
      jsonb_build_object(
        'operation_id', '00000000-0000-0000-0000-000000009591',
        'entity_type', 'trip',
        'entity_id', '00000000-0000-0000-0000-000000005592',
        'action', 'delete'
      ),
      '00000000-0000-0000-0000-000000000592'
    );
    RAISE EXCEPTION 'Internal command RPC unexpectedly executed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;
ROLLBACK;
