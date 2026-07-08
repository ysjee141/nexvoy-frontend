-- TASK-015 targeted smoke checks for local Supabase.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task015_key_provisioning.sql

RESET ROLE;

DELETE FROM public.documents
WHERE id = '21500000-0000-0000-0000-000000000001';

DELETE FROM auth.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000151',
  '00000000-0000-0000-0000-000000000152',
  '00000000-0000-0000-0000-000000000153'
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
    '00000000-0000-0000-0000-000000000151',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'task015-owner.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000152',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'task015-editor.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000153',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'task015-viewer.onvoy.local@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000151';

INSERT INTO public.documents (id, owner_id, type, schema_version, snapshot, snapshot_hash)
VALUES (
  '21500000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000151',
  'trip',
  1,
  decode('aabbcc', 'hex'),
  'task015-snapshot'
);

INSERT INTO public.document_members (document_id, user_id, role, status)
VALUES
  (
    '21500000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000151',
    'owner',
    'accepted'
  ),
  (
    '21500000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000152',
    'editor',
    'accepted'
  ),
  (
    '21500000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000153',
    'viewer',
    'accepted'
  );

SELECT public.upsert_owner_document_key(
  '21500000-0000-0000-0000-000000000001',
  decode('0011', 'hex'),
  'AES-KW-256',
  1
);

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000152';

SELECT public.register_user_key_material(
  'web-editor-1',
  'RSA-OAEP-256',
  '{"kty":"RSA","alg":"RSA-OAEP-256","key_ops":["wrapKey"],"ext":true,"n":"dGFzazAxNWVkaXRvcnB1YmxpYw","e":"AQAB"}'::jsonb,
  1
);

DO $$
DECLARE
  status_payload jsonb;
BEGIN
  status_payload := public.request_document_key_provisioning(
    '21500000-0000-0000-0000-000000000001',
    'web-editor-1',
    1
  );

  IF status_payload ->> 'status' <> 'pending' THEN
    RAISE EXCEPTION 'Expected pending provisioning request, got %', status_payload;
  END IF;
END $$;

CREATE TEMP TABLE task015_request_ids (
  name text PRIMARY KEY,
  request_id uuid NOT NULL
) ON COMMIT PRESERVE ROWS;

RESET ROLE;
INSERT INTO task015_request_ids (name, request_id)
SELECT 'editor', id
FROM public.document_key_provisioning_requests
WHERE document_id = '21500000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000152'
  AND device_id = 'web-editor-1'
LIMIT 1;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000151';

DO $$
DECLARE
  request_id uuid;
  begun jsonb;
  completed jsonb;
BEGIN
  SELECT task015_request_ids.request_id INTO request_id
  FROM task015_request_ids
  WHERE name = 'editor';

  begun := public.begin_document_key_provisioning(request_id);
  IF begun ->> 'status' <> 'processing' THEN
    RAISE EXCEPTION 'Expected processing request, got %', begun;
  END IF;

  completed := public.complete_document_key_provisioning(
    request_id,
    decode('445566', 'hex'),
    'RSA-OAEP-256',
    1
  );
  IF completed ->> 'status' <> 'completed' THEN
    RAISE EXCEPTION 'Expected completed request, got %', completed;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000152';

DO $$
DECLARE
  active_key jsonb;
BEGIN
  active_key := public.get_my_active_document_key(
    '21500000-0000-0000-0000-000000000001',
    'web-editor-1',
    1
  );

  IF active_key IS NULL OR active_key ->> 'wrapping_alg' <> 'RSA-OAEP-256' THEN
    RAISE EXCEPTION 'Expected editor active RSA key, got %', active_key;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000153';

SELECT public.register_user_key_material(
  'web-viewer-1',
  'RSA-OAEP-256',
  '{"kty":"RSA","alg":"RSA-OAEP-256","key_ops":["wrapKey"],"ext":true,"n":"dGFzazAxNXZpZXdlcnB1YmxpYw","e":"AQAB"}'::jsonb,
  1
);

SELECT public.request_document_key_provisioning(
  '21500000-0000-0000-0000-000000000001',
  'web-viewer-1',
  1
);

RESET ROLE;
INSERT INTO task015_request_ids (name, request_id)
SELECT 'viewer', id
FROM public.document_key_provisioning_requests
WHERE document_id = '21500000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000153'
  AND device_id = 'web-viewer-1'
LIMIT 1;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000153';

DO $$
DECLARE
  request_id uuid;
BEGIN
  SELECT task015_request_ids.request_id INTO request_id
  FROM task015_request_ids
  WHERE name = 'viewer';

  PERFORM public.begin_document_key_provisioning(request_id);
  RAISE EXCEPTION 'Expected viewer provisioning processor to be blocked';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Viewer provisioning processor blocked as expected';
END $$;

RESET ROLE;

SELECT 'task015_key_provisioning_checks_passed' AS result;
