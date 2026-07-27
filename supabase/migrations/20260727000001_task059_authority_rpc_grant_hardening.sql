-- TASK-059: make the PostgREST RPC surface an explicit allowlist.
--
-- Supabase grants new public-schema functions to API roles through default
-- privileges. REVOKE FROM PUBLIC alone therefore leaves explicit anon and
-- authenticated grants in place. Internal SECURITY DEFINER functions must
-- never be callable as RPCs.

CREATE OR REPLACE FUNCTION public.check_can_read_authority_trip(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT DISTINCT FROM auth.uid()
    AND p_trip_id IS NOT NULL
    AND (
      public.check_is_document_member(p_trip_id, p_user_id)
      OR public.check_is_public_trip(p_trip_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.check_can_write_authority_trip(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT DISTINCT FROM auth.uid()
    AND p_trip_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND public.check_is_document_editor(p_trip_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.check_can_read_authority_template(
  p_template_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT DISTINCT FROM auth.uid()
    AND p_template_id IS NOT NULL
    AND (
      public.check_is_document_member(p_template_id, p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.checklist_templates template
        WHERE template.id = p_template_id
          AND template.deleted_at IS NULL
          AND template.user_id IS NULL
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.check_can_write_authority_template(
  p_template_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT DISTINCT FROM auth.uid()
    AND p_template_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND public.check_is_document_editor(p_template_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_receive_authority_topic(
  p_topic text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resource_id uuid;
BEGIN
  IF p_topic IS NULL
    OR p_user_id IS NULL
    OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  IF p_topic ~ '^trip:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    resource_id := split_part(p_topic, ':', 2)::uuid;
    RETURN public.check_can_read_authority_trip(resource_id, p_user_id);
  END IF;

  IF p_topic ~ '^template:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    resource_id := split_part(p_topic, ':', 2)::uuid;
    RETURN public.check_can_read_authority_template(resource_id, p_user_id);
  END IF;

  RETURN false;
END;
$$;

-- Trigger and command internals are executable only by the database owner and
-- service role. Product clients must use the public wrappers below.
REVOKE ALL ON FUNCTION public.set_authority_row_metadata()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_one_trip_authority_command(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_one_template_authority_command(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_trip_authority_commands(uuid, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_template_authority_commands(uuid, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trip_authority_stale_batch_is_rebasable(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.template_authority_stale_batch_is_rebasable(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_authority_state_invalidation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_authority_revision_for_membership(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_targeted_invitation_recipient(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_document_invitation_unchecked(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_document_invitation_link_legacy(
  uuid, text, timestamp with time zone, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_authority_row_metadata() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_one_trip_authority_command(uuid, jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_one_template_authority_command(uuid, jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_trip_authority_commands(uuid, jsonb, bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_template_authority_commands(uuid, jsonb, bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.trip_authority_stale_batch_is_rebasable(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.template_authority_stale_batch_is_rebasable(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_authority_state_invalidation() TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_authority_revision_for_membership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_targeted_invitation_recipient(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_document_invitation_unchecked(text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_document_invitation_link_legacy(
  uuid, text, timestamp with time zone, integer
) TO service_role;

-- RLS helpers remain executable by the roles whose policies call them. The
-- identity-bound helpers above prevent callers from probing another user.
REVOKE ALL ON FUNCTION public.check_can_read_authority_trip(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_can_read_authority_template(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_can_write_authority_trip(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_can_write_authority_template(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_trip_authority_resource(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_trip_authority_plan(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_trip_authority_checklist(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_trip_authority_checklist_item(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_template_authority_resource(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_can_read_authority_trip(uuid, uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_can_read_authority_template(uuid, uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_can_write_authority_trip(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_can_write_authority_template(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_resource(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_plan(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_checklist(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_checklist_item(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_template_authority_resource(uuid)
  TO anon, authenticated, service_role;

-- Authenticated product RPCs. Explicitly clear anon grants inherited from
-- Supabase default privileges before rebuilding the allowlist.
REVOKE ALL ON FUNCTION public.bootstrap_owner_document(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_document_invitation_link(
  uuid, text, timestamp with time zone, integer, text, text, date, date
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_document_invitation(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_pending_document_invitations()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_my_document_invitation(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_my_document_invitation(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_document_collaborators(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_document_pending_invitations(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_document_member_role(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_document_member(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_trip_authority_revision(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_template_authority_revision(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_trip_authority_bundle(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_template_authority_bundle(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_trip_authority_changes(uuid, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_template_authority_changes(uuid, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_trip_authority_summaries()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_template_authority_summaries()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_trip_commands(uuid, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_template_commands(uuid, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_receive_authority_topic(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_can_write_place_photo_object(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_place_photo_asset(
  uuid, uuid, text, integer, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_owner_document(uuid, text, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_document_invitation_link(
  uuid, text, timestamp with time zone, integer, text, text, date, date
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_document_invitation(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_pending_document_invitations()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_my_document_invitation(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_my_document_invitation(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_document_collaborators(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_document_pending_invitations(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_document_member_role(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_document_member(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trip_authority_revision(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_template_authority_revision(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trip_authority_bundle(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_template_authority_bundle(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trip_authority_changes(uuid, jsonb, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_template_authority_changes(uuid, jsonb, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_trip_authority_summaries()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_template_authority_summaries()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_trip_commands(uuid, jsonb, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_template_commands(uuid, jsonb, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_receive_authority_topic(text, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_can_write_place_photo_object(text, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_place_photo_asset(
  uuid, uuid, text, integer, text
) TO authenticated, service_role;

-- Invitation summary is the only TASK-043~059 product RPC intentionally
-- available before login.
REVOKE ALL ON FUNCTION public.get_document_invitation_summary(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_invitation_summary(text, text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_orphan_place_photo_assets(interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_place_photo_assets(interval)
  TO service_role;
