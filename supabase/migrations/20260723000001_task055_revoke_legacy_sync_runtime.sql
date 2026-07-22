-- TASK-055: retire client-managed document sync without destroying Production data.
--
-- This migration is intentionally revoke-first. Legacy tables and payload columns
-- remain available to postgres/service_role for rollback and export, while Data API
-- clients can use only canonical authority, membership, invitation, and share RPCs.

-- 1) Membership revocation no longer mutates document keys or provisioning queues.
CREATE OR REPLACE FUNCTION public.revoke_document_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_member public.document_members%ROWTYPE;
  cleaned_notification_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO target_member
  FROM public.document_members
  WHERE id = p_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 회수할 수 없습니다.';
  END IF;

  UPDATE public.document_members
  SET status = 'revoked', updated_at = timezone('utc', now())
  WHERE id = p_member_id
  RETURNING * INTO target_member;

  IF target_member.user_id IS NOT NULL THEN
    cleaned_notification_count := public.cleanup_document_notification_state(
      target_member.document_id,
      target_member.user_id
    );
  END IF;

  PERFORM public.bump_authority_revision_for_membership(target_member.document_id);

  RETURN jsonb_build_object(
    'document_id', target_member.document_id,
    'member_id', target_member.id,
    'user_id', target_member.user_id,
    'cleaned_notification_count', cleaned_notification_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_document_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_document_member(uuid) TO authenticated;

-- 2) Registry rows remain, but clients cannot write V1 snapshot metadata directly.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.documents FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.document_members FROM PUBLIC, anon, authenticated;

-- 3) Preserve legacy rows for rollback/export while removing all Data API access.
REVOKE ALL ON TABLE public.document_updates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.document_devices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.legacy_row_map FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.document_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_key_materials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.document_key_provisioning_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.document_signaling_room_topics FROM PUBLIC, anon, authenticated;

-- Old relational invitation/share write paths are superseded by document RPCs.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.trip_members FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.trip_shares FROM PUBLIC, anon, authenticated;

-- 4) Retire key-management RPCs. SECURITY DEFINER owners retain rollback access.
REVOKE ALL ON FUNCTION public.sanitize_key_provisioning_error_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_document_key_for_device(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_key_provisioning_notification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_key_provisioning_requests_for_user(uuid, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_user_key_material(text, text, jsonb, integer, text, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_user_key_material(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_document_key_provisioning(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_document_key_provisioning_status(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_pending_document_key_provisioning_requests(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_document_key_provisioning(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_document_key_provisioning(uuid, bytea, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_document_key_provisioning_failed(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_active_document_key(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_owner_document_key(uuid, bytea, text, integer, text, integer) FROM PUBLIC, anon, authenticated;

-- 5) Retire signaling and pre-registry collaboration RPCs.
REVOKE ALL ON FUNCTION public.issue_document_signaling_room_topic(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_receive_document_signaling_topic(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_send_document_signaling_topic(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_invitation_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_trip_summary_by_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_trip_via_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_trip_document_member_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_trip_document_member(uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "accepted document members can receive signaling broadcast"
  ON realtime.messages;
DROP POLICY IF EXISTS "accepted non-viewer document members can send signaling broadcast"
  ON realtime.messages;

-- Realtime authorizes a private channel with a synthetic Broadcast probe, not the
-- eventual application event. Restrict by topic membership and extension only.
DROP POLICY IF EXISTS "authority readers can receive revision invalidations"
  ON realtime.messages;
CREATE POLICY "authority readers can receive revision invalidations"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND public.can_receive_authority_topic(realtime.topic(), (SELECT auth.uid()))
);
