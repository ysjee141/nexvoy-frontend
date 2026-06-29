-- TASK-007 targeted RLS checks for local Supabase.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task007_document_keys_rls.sql

RESET ROLE;

DELETE FROM public.documents
WHERE id = '20000000-0000-0000-0000-000000000001';

DELETE FROM auth.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000014'
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
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'key-owner.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'key-editor.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'key-viewer.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'key-outsider.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';

INSERT INTO public.documents (id, owner_id, type, schema_version, snapshot, snapshot_hash)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  'trip',
  1,
  decode('aabbcc', 'hex'),
  'key-snapshot'
);

INSERT INTO public.document_members (document_id, user_id, role, status)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'owner',
    'accepted'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000012',
    'editor',
    'accepted'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013',
    'viewer',
    'accepted'
  );

INSERT INTO public.document_keys (document_id, user_id, key_version, wrapped_dek, wrapping_alg)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    1,
    decode('0011', 'hex'),
    'AES-KW-256'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000012',
    1,
    decode('0022', 'hex'),
    'AES-KW-256'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013',
    1,
    decode('0033', 'hex'),
    'AES-KW-256'
  );

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';

DO $$
DECLARE
  visible_keys integer;
BEGIN
  SELECT count(*) INTO visible_keys
  FROM public.document_keys
  WHERE document_id = '20000000-0000-0000-0000-000000000001';

  IF visible_keys <> 1 THEN
    RAISE EXCEPTION 'Expected editor to read only own key, got %', visible_keys;
  END IF;
END $$;

DO $$
BEGIN
  INSERT INTO public.document_keys (document_id, user_id, key_version, wrapped_dek, wrapping_alg)
  VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000012',
    2,
    decode('0044', 'hex'),
    'AES-KW-256'
  );

  RAISE EXCEPTION 'Expected editor key insert to be blocked';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Editor key insert blocked as expected';
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000014';

DO $$
DECLARE
  visible_keys integer;
BEGIN
  SELECT count(*) INTO visible_keys
  FROM public.document_keys
  WHERE document_id = '20000000-0000-0000-0000-000000000001';

  IF visible_keys <> 0 THEN
    RAISE EXCEPTION 'Expected outsider to read zero keys, got %', visible_keys;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';

UPDATE public.document_keys
SET revoked_at = now()
WHERE document_id = '20000000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000013';

UPDATE public.document_members
SET status = 'revoked'
WHERE document_id = '20000000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000012';

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000013';

DO $$
DECLARE
  visible_keys integer;
BEGIN
  SELECT count(*) INTO visible_keys
  FROM public.document_keys
  WHERE document_id = '20000000-0000-0000-0000-000000000001';

  IF visible_keys <> 0 THEN
    RAISE EXCEPTION 'Expected viewer revoked key to be hidden, got %', visible_keys;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';

DO $$
DECLARE
  visible_keys integer;
BEGIN
  SELECT count(*) INTO visible_keys
  FROM public.document_keys
  WHERE document_id = '20000000-0000-0000-0000-000000000001';

  IF visible_keys <> 0 THEN
    RAISE EXCEPTION 'Expected revoked editor member to read zero keys, got %', visible_keys;
  END IF;
END $$;

RESET ROLE;

SELECT 'task007_document_keys_rls_checks_passed' AS result;
