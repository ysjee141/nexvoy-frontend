-- TASK-037 hotfix: document permission helpers must tolerate legacy trips that
-- have not yet been materialized into document_members.
--
-- During the document-primary transition, TripDocumentV1 uses the legacy
-- trips.id as document_id. Existing trips can therefore be valid editable
-- documents before their document_members registry row is bootstrapped. RPCs
-- such as get_my_active_document_key rely on check_is_document_member(), so
-- they need the same legacy compatibility that signaling received in TASK-025.

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
  )
  OR EXISTS (
    SELECT 1
    FROM public.trips
    WHERE id = _document_id
      AND user_id = _user_id
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _document_id
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _document_id
      AND user_id = _user_id
      AND status = 'accepted'
      AND role = 'editor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_is_document_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_document_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_document_editor(uuid, uuid) TO anon, authenticated;
