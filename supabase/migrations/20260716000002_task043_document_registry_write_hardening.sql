-- TASK-043: document authority mutations must go through authenticated RPCs.
-- Snapshot updates remain RLS-protected direct updates, while document creation
-- and membership changes are handled by SECURITY DEFINER functions that derive
-- the actor from auth.uid().

DROP POLICY IF EXISTS "Insert documents as owner" ON public.documents;

DROP POLICY IF EXISTS "Insert document members as owner" ON public.document_members;
DROP POLICY IF EXISTS "Update document members as owner" ON public.document_members;
DROP POLICY IF EXISTS "Delete document members as owner" ON public.document_members;
