-- Local-first encrypted backup schema foundation.
-- TASK-006: stores document snapshots/update blobs while legacy row tables remain authoritative fallback.

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('trip', 'template')),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  snapshot bytea,
  snapshot_hash text,
  encrypted boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_email text,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS document_members_document_id_user_id_key
  ON public.document_members(document_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_members_document_id_invited_email_key
  ON public.document_members(document_id, invited_email)
  WHERE invited_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.document_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  client_id text NOT NULL,
  seq bigint NOT NULL CHECK (seq >= 0),
  update_blob bytea NOT NULL,
  update_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(document_id, client_id, seq)
);

CREATE TABLE IF NOT EXISTS public.document_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  device_id text NOT NULL,
  last_synced_seq bigint CHECK (last_synced_seq IS NULL OR last_synced_seq >= 0),
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(document_id, user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.legacy_row_map (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  path_in_document text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(table_name, row_id)
);

CREATE INDEX IF NOT EXISTS documents_owner_id_idx
  ON public.documents(owner_id);

CREATE INDEX IF NOT EXISTS document_members_document_id_idx
  ON public.document_members(document_id);

CREATE INDEX IF NOT EXISTS document_members_user_id_idx
  ON public.document_members(user_id);

CREATE INDEX IF NOT EXISTS document_updates_document_id_created_at_idx
  ON public.document_updates(document_id, created_at);

CREATE INDEX IF NOT EXISTS document_devices_user_id_idx
  ON public.document_devices(user_id);

CREATE INDEX IF NOT EXISTS legacy_row_map_document_id_idx
  ON public.legacy_row_map(document_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_row_map ENABLE ROW LEVEL SECURITY;

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

-- documents ------------------------------------------------------------------
CREATE POLICY "Select documents if accepted member"
  ON public.documents
  FOR SELECT
  USING (public.check_is_document_member(id, auth.uid()));

CREATE POLICY "Insert documents as owner"
  ON public.documents
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Update documents as owner"
  ON public.documents
  FOR UPDATE
  USING (public.check_is_document_owner(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Delete documents as owner"
  ON public.documents
  FOR DELETE
  USING (public.check_is_document_owner(id, auth.uid()));

-- document_members -----------------------------------------------------------
CREATE POLICY "Select document members if related"
  ON public.document_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR invited_email = (auth.jwt() ->> 'email')
    OR public.check_is_document_member(document_id, auth.uid())
  );

CREATE POLICY "Insert document members as owner"
  ON public.document_members
  FOR INSERT
  WITH CHECK (public.check_is_document_owner(document_id, auth.uid()));

CREATE POLICY "Update document members as owner"
  ON public.document_members
  FOR UPDATE
  USING (public.check_is_document_owner(document_id, auth.uid()))
  WITH CHECK (public.check_is_document_owner(document_id, auth.uid()));

CREATE POLICY "Delete document members as owner"
  ON public.document_members
  FOR DELETE
  USING (public.check_is_document_owner(document_id, auth.uid()));

-- document_updates -----------------------------------------------------------
CREATE POLICY "Select document updates if accepted member"
  ON public.document_updates
  FOR SELECT
  USING (public.check_is_document_member(document_id, auth.uid()));

CREATE POLICY "Insert document updates as editor"
  ON public.document_updates
  FOR INSERT
  WITH CHECK (public.check_is_document_editor(document_id, auth.uid()));

-- document_devices -----------------------------------------------------------
CREATE POLICY "Select own document devices"
  ON public.document_devices
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.check_is_document_member(document_id, auth.uid())
  );

CREATE POLICY "Insert own document devices"
  ON public.document_devices
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.check_is_document_member(document_id, auth.uid())
  );

CREATE POLICY "Update own document devices"
  ON public.document_devices
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.check_is_document_member(document_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.check_is_document_member(document_id, auth.uid())
  );

CREATE POLICY "Delete own document devices"
  ON public.document_devices
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND public.check_is_document_member(document_id, auth.uid())
  );

-- legacy_row_map -------------------------------------------------------------
CREATE POLICY "Select legacy row map if accepted member"
  ON public.legacy_row_map
  FOR SELECT
  USING (public.check_is_document_member(document_id, auth.uid()));

CREATE POLICY "Insert legacy row map as editor"
  ON public.legacy_row_map
  FOR INSERT
  WITH CHECK (public.check_is_document_editor(document_id, auth.uid()));

CREATE POLICY "Update legacy row map as editor"
  ON public.legacy_row_map
  FOR UPDATE
  USING (public.check_is_document_editor(document_id, auth.uid()))
  WITH CHECK (public.check_is_document_editor(document_id, auth.uid()));

CREATE POLICY "Delete legacy row map as owner"
  ON public.legacy_row_map
  FOR DELETE
  USING (public.check_is_document_owner(document_id, auth.uid()));
