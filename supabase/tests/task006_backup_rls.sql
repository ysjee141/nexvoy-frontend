-- TASK-006 targeted RLS checks for local Supabase.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task006_backup_rls.sql

RESET ROLE;

DELETE FROM public.documents
WHERE id = '10000000-0000-0000-0000-000000000001';

DELETE FROM auth.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'editor.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'viewer.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'outsider.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.documents (id, owner_id, type, schema_version, snapshot, snapshot_hash)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'trip',
  1,
  decode('aabbcc', 'hex'),
  'owner-snapshot'
);

INSERT INTO public.document_members (document_id, user_id, role, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner',
    'accepted'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'editor',
    'accepted'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'viewer',
    'accepted'
  );

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

INSERT INTO public.document_updates (document_id, client_id, seq, update_blob, update_hash)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'editor-device',
  1,
  decode('ddee', 'hex'),
  'editor-update'
);

DO $$
DECLARE
  visible_updates integer;
BEGIN
  SELECT count(*) INTO visible_updates
  FROM public.document_updates
  WHERE document_id = '10000000-0000-0000-0000-000000000001';

  IF visible_updates <> 1 THEN
    RAISE EXCEPTION 'Expected editor to read one update, got %', visible_updates;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

DO $$
BEGIN
  INSERT INTO public.document_updates (document_id, client_id, seq, update_blob, update_hash)
  VALUES (
    '10000000-0000-0000-0000-000000000001',
    'viewer-device',
    1,
    decode('ffee', 'hex'),
    'viewer-update'
  );

  RAISE EXCEPTION 'Expected viewer update insert to be blocked';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Viewer update insert blocked as expected';
END $$;

DO $$
DECLARE
  visible_updates integer;
BEGIN
  SELECT count(*) INTO visible_updates
  FROM public.document_updates
  WHERE document_id = '10000000-0000-0000-0000-000000000001';

  IF visible_updates <> 1 THEN
    RAISE EXCEPTION 'Expected viewer to read one update, got %', visible_updates;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

DO $$
DECLARE
  visible_documents integer;
BEGIN
  SELECT count(*) INTO visible_documents
  FROM public.documents
  WHERE id = '10000000-0000-0000-0000-000000000001';

  IF visible_documents <> 0 THEN
    RAISE EXCEPTION 'Expected outsider to read zero documents, got %', visible_documents;
  END IF;
END $$;

RESET ROLE;

SELECT 'task006_backup_rls_checks_passed' AS result;
