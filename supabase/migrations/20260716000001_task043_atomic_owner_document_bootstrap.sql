-- TASK-043: establish a document and its owner membership atomically.
-- Client-side writes previously created these rows in separate requests, which
-- left local-only documents whenever either RLS-protected request failed.

CREATE OR REPLACE FUNCTION public.bootstrap_owner_document(
  p_document_id uuid,
  p_type text,
  p_schema_version integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  existing_owner_id uuid;
  existing_type text;
  affected_rows integer;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_document_id IS NULL
    OR p_type NOT IN ('trip', 'template')
    OR p_schema_version IS NULL
    OR p_schema_version < 1 THEN
    RAISE EXCEPTION '유효하지 않은 문서 생성 요청입니다.';
  END IF;

  SELECT owner_id, type
    INTO existing_owner_id, existing_type
  FROM public.documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF FOUND AND existing_owner_id <> actor_id THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF FOUND AND existing_type <> p_type THEN
    RAISE EXCEPTION '문서 유형이 일치하지 않습니다.';
  END IF;

  INSERT INTO public.documents (
    id,
    owner_id,
    type,
    schema_version,
    updated_at
  )
  VALUES (
    p_document_id,
    actor_id,
    p_type,
    p_schema_version,
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE
    SET schema_version = GREATEST(public.documents.schema_version, EXCLUDED.schema_version)
    WHERE public.documents.owner_id = actor_id
      AND public.documents.type = EXCLUDED.type;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  INSERT INTO public.document_members (
    document_id,
    user_id,
    role,
    status,
    updated_at
  )
  VALUES (
    p_document_id,
    actor_id,
    'owner',
    'accepted',
    timezone('utc', now())
  )
  ON CONFLICT (document_id, user_id) DO UPDATE
    SET role = 'owner',
        status = 'accepted',
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'owner_id', actor_id,
    'type', p_type,
    'schema_version', p_schema_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_owner_document(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner_document(uuid, text, integer) TO authenticated;

-- The current product starts from document-primary data. Legacy row tables are
-- not an authority source and must not grant document access implicitly.
CREATE OR REPLACE FUNCTION public.check_is_document_owner(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents
    WHERE id = _document_id
      AND owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.document_members
    WHERE document_id = _document_id
      AND user_id = _user_id
      AND status = 'accepted'
      AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_document_member(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_is_document_owner(_document_id, _user_id)
  OR EXISTS (
    SELECT 1
    FROM public.document_members
    WHERE document_id = _document_id
      AND user_id = _user_id
      AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_document_editor(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_is_document_owner(_document_id, _user_id)
  OR EXISTS (
    SELECT 1
    FROM public.document_members
    WHERE document_id = _document_id
      AND user_id = _user_id
      AND status = 'accepted'
      AND role IN ('owner', 'editor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_is_document_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_document_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_document_editor(uuid, uuid) TO anon, authenticated;
