-- TASK-007: server-wrapped document key storage.
-- Stores wrapped DEKs only. Plain DEKs/KEKs must never be written to Supabase.

CREATE TABLE IF NOT EXISTS public.document_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  key_version integer NOT NULL CHECK (key_version > 0),
  wrapped_dek bytea NOT NULL,
  wrapping_alg text NOT NULL CHECK (wrapping_alg IN ('AES-KW-256')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  revoked_at timestamp with time zone,
  UNIQUE(document_id, user_id, key_version)
);

CREATE INDEX IF NOT EXISTS document_keys_document_id_idx
  ON public.document_keys(document_id);

CREATE INDEX IF NOT EXISTS document_keys_user_id_idx
  ON public.document_keys(user_id);

ALTER TABLE public.document_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select document keys by owner or own active member"
  ON public.document_keys
  FOR SELECT
  USING (
    public.check_is_document_owner(document_id, auth.uid())
    OR (
      user_id = auth.uid()
      AND revoked_at IS NULL
      AND public.check_is_document_member(document_id, auth.uid())
    )
  );

CREATE POLICY "Insert document keys as owner"
  ON public.document_keys
  FOR INSERT
  WITH CHECK (
    public.check_is_document_owner(document_id, auth.uid())
    AND public.check_is_document_member(document_id, user_id)
  );

CREATE POLICY "Revoke document keys as owner"
  ON public.document_keys
  FOR UPDATE
  USING (public.check_is_document_owner(document_id, auth.uid()))
  WITH CHECK (public.check_is_document_owner(document_id, auth.uid()));

CREATE POLICY "Delete document keys as owner"
  ON public.document_keys
  FOR DELETE
  USING (public.check_is_document_owner(document_id, auth.uid()));
