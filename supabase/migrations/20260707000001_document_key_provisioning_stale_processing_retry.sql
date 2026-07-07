-- TASK-017: allow stale processing provisioning requests to be retried.
--
-- Background provisioning uses skip-only failure handling. If a background worker
-- is interrupted after begin_document_key_provisioning(), the request can remain
-- in processing. This function re-lists processing rows after the same 10 minute
-- stale window accepted by begin_document_key_provisioning().

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
    dm.role AS member_role,
    req.status,
    req.key_version,
    req.error_code,
    req.attempt_count,
    req.requested_at,
    req.updated_at
  FROM public.document_key_provisioning_requests req
  JOIN public.user_key_materials ukm ON ukm.id = req.material_id
  JOIN public.document_members dm
    ON dm.document_id = req.document_id
   AND dm.user_id = req.user_id
   AND dm.status = 'accepted'
  WHERE (
      req.status IN ('pending', 'failed')
      OR (
        req.status = 'processing'
        AND req.processing_started_at < timezone('utc'::text, now()) - interval '10 minutes'
      )
    )
    AND ukm.status = 'active'
    AND ukm.revoked_at IS NULL
    AND (p_document_id IS NULL OR req.document_id = p_document_id)
    AND public.check_is_document_editor(req.document_id, auth.uid())
  ORDER BY req.updated_at ASC, req.requested_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_document_key_provisioning_requests(uuid, integer) TO authenticated;
