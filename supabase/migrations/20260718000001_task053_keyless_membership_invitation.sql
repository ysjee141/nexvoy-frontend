-- TASK-053: Membership and invitation without document keys.
--
-- Invitation accept completes as an accepted membership transaction only.
-- The accept path no longer queues document key provisioning, and membership
-- changes (accept / role change / revoke) bump the authority revision so
-- Realtime invalidation reaches active clients. A revoked client's next
-- refresh or command hits authority_*_forbidden (42501) and purges its
-- local cache/outbox. Physical removal of legacy key tables/RPCs stays in
-- TASK-055.

-- 1) Membership changes bump the resource authority revision.
CREATE OR REPLACE FUNCTION public.bump_authority_revision_for_membership(
  p_document_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trips WHERE id = p_document_id) THEN
    INSERT INTO public.trip_authority_state AS state (
      trip_id, revision, changed_entities, updated_at
    ) VALUES (
      p_document_id, 1, '[]'::jsonb, timezone('utc', now())
    )
    ON CONFLICT (trip_id) DO UPDATE
      SET revision = state.revision + 1,
          changed_entities = '[]'::jsonb,
          updated_at = EXCLUDED.updated_at;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.checklist_templates WHERE id = p_document_id) THEN
    INSERT INTO public.template_authority_state AS state (
      template_id, revision, changed_entities, updated_at
    ) VALUES (
      p_document_id, 1, '[]'::jsonb, timezone('utc', now())
    )
    ON CONFLICT (template_id) DO UPDATE
      SET revision = state.revision + 1,
          changed_entities = '[]'::jsonb,
          updated_at = EXCLUDED.updated_at;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_authority_revision_for_membership(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Keyless invitation accept: accepted membership is the completion
--    condition. No key readiness, no provisioning queue, no notification.
--    Response keeps the legacy provisioning fields as terminal values for
--    client compatibility (always completed).
CREATE OR REPLACE FUNCTION public.accept_document_invitation_unchecked(
  p_token text DEFAULT NULL,
  p_invite_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.document_invitation_links%ROWTYPE;
  member_record public.document_members%ROWTYPE;
  current_email text;
  is_owner boolean;
  already_accepted boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NULLIF(p_token, '') IS NULL AND NULLIF(p_invite_code, '') IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  SELECT *
    INTO link_record
  FROM public.document_invitation_links
  WHERE (
      NULLIF(p_token, '') IS NOT NULL
      AND token_hash = public.document_registry_hash(p_token)
    )
    OR (
      NULLIF(p_invite_code, '') IS NOT NULL
      AND invite_code_hash = public.document_registry_hash(upper(regexp_replace(p_invite_code, '[^[:alnum:]]', '', 'g')))
    )
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
    OR link_record.revoked_at IS NOT NULL
    OR (link_record.expires_at IS NOT NULL AND link_record.expires_at <= timezone('utc'::text, now()))
  THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  is_owner := public.check_is_document_owner(link_record.document_id, auth.uid());

  SELECT *
    INTO member_record
  FROM public.document_members
  WHERE document_id = link_record.document_id
    AND user_id = auth.uid()
  LIMIT 1;

  already_accepted := is_owner OR (FOUND AND member_record.status = 'accepted');

  IF NOT already_accepted THEN
    IF link_record.max_uses IS NOT NULL AND link_record.used_count >= link_record.max_uses THEN
      RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
    END IF;

    current_email := COALESCE(auth.jwt() ->> 'email', (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    ));

    IF member_record.id IS NOT NULL THEN
      UPDATE public.document_members
        SET role = link_record.role,
            status = 'accepted',
            updated_at = timezone('utc'::text, now())
        WHERE id = member_record.id
        RETURNING * INTO member_record;
    ELSIF current_email IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.document_members
      WHERE document_id = link_record.document_id
        AND invited_email = current_email
        AND status <> 'accepted'
    ) THEN
      UPDATE public.document_members
        SET user_id = auth.uid(),
            role = link_record.role,
            status = 'accepted',
            updated_at = timezone('utc'::text, now())
        WHERE document_id = link_record.document_id
          AND invited_email = current_email
          AND status <> 'accepted'
        RETURNING * INTO member_record;
    ELSE
      INSERT INTO public.document_members (
        document_id,
        user_id,
        invited_email,
        role,
        status
      )
      VALUES (
        link_record.document_id,
        auth.uid(),
        current_email,
        link_record.role,
        'accepted'
      )
      RETURNING * INTO member_record;
    END IF;

    UPDATE public.document_invitation_links
      SET used_count = used_count + 1,
          updated_at = timezone('utc'::text, now())
      WHERE id = link_record.id;

    PERFORM public.bump_authority_revision_for_membership(link_record.document_id);
  END IF;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id,
    'role', CASE WHEN is_owner THEN 'owner' ELSE member_record.role END,
    'status', 'accepted',
    'already_member', already_accepted,
    'requires_key_provisioning', false,
    'key_provisioning_status', 'completed',
    'queued_request_count', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_document_invitation_unchecked(text, text) FROM PUBLIC, anon, authenticated;

-- 2b) Pending-invitation accept (accept_my_document_invitation) drops the
--     provisioning queue the same way.
CREATE OR REPLACE FUNCTION public.accept_my_document_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.document_invitation_links%ROWTYPE;
  member_id uuid;
  already_accepted boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  SELECT * INTO link_record FROM public.document_invitation_links WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR link_record.revoked_at IS NOT NULL OR link_record.used_count > 0
    OR (link_record.expires_at IS NOT NULL AND link_record.expires_at <= timezone('utc', now())) THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;
  PERFORM public.assert_targeted_invitation_recipient(link_record.id);

  SELECT EXISTS (
    SELECT 1 FROM public.document_members
    WHERE document_id = link_record.document_id AND user_id = auth.uid() AND status = 'accepted'
  ) OR public.check_is_document_owner(link_record.document_id, auth.uid())
  INTO already_accepted;

  IF NOT already_accepted THEN
    UPDATE public.document_members
      SET user_id = auth.uid(), role = link_record.role, status = 'accepted',
          updated_at = timezone('utc', now())
      WHERE document_id = link_record.document_id
        AND invited_email = link_record.target_email AND status <> 'accepted'
      RETURNING id INTO member_id;

    IF member_id IS NULL THEN
      INSERT INTO public.document_members(document_id, user_id, invited_email, role, status, updated_at)
      VALUES (link_record.document_id, auth.uid(), link_record.target_email, link_record.role, 'accepted', timezone('utc', now()))
      ON CONFLICT (document_id, user_id) DO UPDATE SET
        status = 'accepted', updated_at = EXCLUDED.updated_at
      RETURNING id INTO member_id;
    END IF;

    PERFORM public.bump_authority_revision_for_membership(link_record.document_id);
  END IF;

  UPDATE public.document_invitation_links SET used_count = 1, updated_at = timezone('utc', now())
  WHERE id = link_record.id;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id, 'role', link_record.role,
    'status', 'accepted', 'already_member', already_accepted,
    'requires_key_provisioning', false,
    'key_provisioning_status', 'completed',
    'queued_request_count', 0
  );
END;
$$;

-- 3) Role change stays RPC-only and now propagates via authority revision.
CREATE OR REPLACE FUNCTION public.set_document_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.document_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION '유효하지 않은 역할입니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.document_members
  WHERE id = p_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 변경할 수 없습니다.';
  END IF;

  UPDATE public.document_members
    SET role = p_role,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_member_id;

  PERFORM public.bump_authority_revision_for_membership(target_member.document_id);
END;
$$;

-- 4) Revoke keeps legacy key/notification cleanup (removed for good in
--    TASK-055) and now bumps the authority revision so remaining members
--    refresh and the revoked client's next access is denied server-side.
CREATE OR REPLACE FUNCTION public.revoke_document_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.document_members%ROWTYPE;
  revoked_key_count integer := 0;
  cancelled_request_count integer := 0;
  cleaned_notification_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.document_members
  WHERE id = p_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 회수할 수 없습니다.';
  END IF;

  UPDATE public.document_members
    SET status = 'revoked',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_member_id
    RETURNING * INTO target_member;

  IF target_member.user_id IS NOT NULL THEN
    UPDATE public.document_keys
      SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now()))
      WHERE document_id = target_member.document_id
        AND user_id = target_member.user_id
        AND revoked_at IS NULL;

    GET DIAGNOSTICS revoked_key_count = ROW_COUNT;

    UPDATE public.document_key_provisioning_requests
      SET status = 'cancelled',
          cancelled_at = COALESCE(cancelled_at, timezone('utc'::text, now())),
          updated_at = timezone('utc'::text, now())
      WHERE document_id = target_member.document_id
        AND user_id = target_member.user_id
        AND status IN ('waiting_for_material', 'pending', 'processing', 'failed');

    GET DIAGNOSTICS cancelled_request_count = ROW_COUNT;

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
    'revoked_key_count', revoked_key_count,
    'cancelled_request_count', cancelled_request_count,
    'cleaned_notification_count', cleaned_notification_count
  );
END;
$$;
