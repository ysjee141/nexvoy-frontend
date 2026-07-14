-- TASK-037 follow-up: owner-side key provisioning must see accepted legacy
-- trip_members while document-primary registry bootstrap is still lazy.
--
-- Existing trips can have valid accepted collaborators in trip_members before
-- their document_members rows are materialized. request_document_key_provisioning()
-- already accepts these users through check_is_document_member(), but
-- list_pending_document_key_provisioning_requests() joined document_members
-- directly and therefore hid their pending key requests from the owner.

CREATE OR REPLACE FUNCTION public.list_pending_document_key_provisioning_requests(
  p_document_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  user_id uuid,
  device_id text,
  material_id uuid,
  wrapping_alg text,
  public_key_jwk jsonb,
  material_version integer,
  member_role text,
  status text,
  key_version integer,
  error_code text,
  attempt_count integer,
  requested_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  RETURN QUERY
  SELECT
    req.id,
    req.document_id,
    req.user_id,
    req.device_id,
    req.material_id,
    ukm.wrapping_alg,
    ukm.public_key_jwk,
    ukm.material_version,
    COALESCE(dm.role, tm.role, 'viewer') AS member_role,
    req.status,
    req.key_version,
    req.error_code,
    req.attempt_count,
    req.requested_at,
    req.updated_at
  FROM public.document_key_provisioning_requests req
  JOIN public.user_key_materials ukm ON ukm.id = req.material_id
  LEFT JOIN public.document_members dm
    ON dm.document_id = req.document_id
   AND dm.user_id = req.user_id
   AND dm.status = 'accepted'
  LEFT JOIN public.trip_members tm
    ON tm.trip_id = req.document_id
   AND tm.user_id = req.user_id
   AND tm.status = 'accepted'
  WHERE req.status IN ('pending', 'failed')
    AND ukm.status = 'active'
    AND ukm.revoked_at IS NULL
    AND (p_document_id IS NULL OR req.document_id = p_document_id)
    AND public.check_is_document_editor(req.document_id, auth.uid())
    AND (dm.user_id IS NOT NULL OR tm.user_id IS NOT NULL OR public.check_is_document_owner(req.document_id, req.user_id))
  ORDER BY req.updated_at ASC, req.requested_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_document_key_provisioning_requests(uuid, integer) TO authenticated;
