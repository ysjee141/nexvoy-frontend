-- TASK-044: targeted invitation authority for document-primary collaboration.

ALTER TABLE public.document_invitation_links
  ADD COLUMN IF NOT EXISTS target_email text,
  ADD COLUMN IF NOT EXISTS invitation_kind text NOT NULL DEFAULT 'generic'
    CHECK (invitation_kind IN ('generic', 'targeted')),
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

CREATE INDEX IF NOT EXISTS document_invitation_links_target_email_idx
  ON public.document_invitation_links(target_email)
  WHERE target_email IS NOT NULL AND revoked_at IS NULL;

ALTER FUNCTION public.create_document_invitation_link(uuid, text, timestamp with time zone, integer)
  RENAME TO create_document_invitation_link_legacy;

CREATE OR REPLACE FUNCTION public.create_document_invitation_link(
  p_document_id uuid,
  p_role text,
  p_expires_at timestamp with time zone DEFAULT NULL,
  p_max_uses integer DEFAULT 1,
  p_target_email text DEFAULT NULL,
  p_destination text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := NULLIF(lower(btrim(p_target_email)), '');
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_is_document_editor(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF normalized_email IS NOT NULL AND normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
    RAISE EXCEPTION '유효한 이메일 주소를 입력해 주세요.';
  END IF;

  IF normalized_email IS NOT NULL THEN
    UPDATE public.document_invitation_links
      SET revoked_at = timezone('utc', now()), updated_at = timezone('utc', now())
      WHERE document_id = p_document_id
        AND target_email = normalized_email
        AND revoked_at IS NULL
        AND used_count = 0;
  END IF;

  result := public.create_document_invitation_link_legacy(
    p_document_id, p_role, p_expires_at, p_max_uses
  );

  UPDATE public.document_invitation_links
    SET target_email = normalized_email,
        invitation_kind = CASE WHEN normalized_email IS NULL THEN 'generic' ELSE 'targeted' END,
        destination = NULLIF(btrim(p_destination), ''),
        start_date = p_start_date,
        end_date = p_end_date,
        updated_at = timezone('utc', now())
    WHERE id = (result ->> 'id')::uuid;

  RETURN result || jsonb_build_object(
    'target_email', normalized_email,
    'invitation_kind', CASE WHEN normalized_email IS NULL THEN 'generic' ELSE 'targeted' END
  );
END;
$$;

ALTER FUNCTION public.accept_document_invitation(text, text)
  RENAME TO accept_document_invitation_unchecked;

CREATE OR REPLACE FUNCTION public.assert_targeted_invitation_recipient(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected_email text;
  current_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  SELECT target_email INTO expected_email
  FROM public.document_invitation_links
  WHERE id = p_invitation_id;

  IF expected_email IS NOT NULL AND expected_email <> current_email THEN
    RAISE EXCEPTION '이 초대는 다른 계정으로 전송되었습니다.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_document_invitation(
  p_token text DEFAULT NULL,
  p_invite_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_id uuid;
BEGIN
  SELECT id INTO invitation_id
  FROM public.document_invitation_links
  WHERE (NULLIF(p_token, '') IS NOT NULL AND token_hash = public.document_registry_hash(p_token))
     OR (NULLIF(p_invite_code, '') IS NOT NULL AND invite_code_hash = public.document_registry_hash(
       upper(regexp_replace(p_invite_code, '[^[:alnum:]]', '', 'g'))
     ))
  LIMIT 1;

  IF invitation_id IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  PERFORM public.assert_targeted_invitation_recipient(invitation_id);
  RETURN public.accept_document_invitation_unchecked(p_token, p_invite_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_document_invitation_summary(
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
BEGIN
  SELECT * INTO link_record
  FROM public.document_invitation_links
  WHERE (NULLIF(p_token, '') IS NOT NULL AND token_hash = public.document_registry_hash(p_token))
     OR (NULLIF(p_invite_code, '') IS NOT NULL AND invite_code_hash = public.document_registry_hash(
       upper(regexp_replace(p_invite_code, '[^[:alnum:]]', '', 'g'))
     ))
  LIMIT 1;

  IF NOT FOUND OR link_record.revoked_at IS NOT NULL
    OR (link_record.expires_at IS NOT NULL AND link_record.expires_at <= timezone('utc', now()))
    OR (link_record.max_uses IS NOT NULL AND link_record.used_count >= link_record.max_uses) THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'document_id', d.id, 'document_type', d.type, 'role', link_record.role,
      'expires_at', link_record.expires_at, 'destination', link_record.destination,
      'start_date', link_record.start_date, 'end_date', link_record.end_date,
      'owner_nickname', p.nickname,
      'member_count', (SELECT count(*) FROM public.document_members dm
        WHERE dm.document_id = d.id AND dm.status = 'accepted')
    )
    FROM public.documents d JOIN public.profiles p ON p.id = d.owner_id
    WHERE d.id = link_record.document_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_pending_document_invitations()
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', l.id, 'document_id', l.document_id, 'role', l.role,
    'destination', l.destination, 'start_date', l.start_date, 'end_date', l.end_date,
    'owner_nickname', p.nickname, 'expires_at', l.expires_at, 'created_at', l.created_at
  )
  FROM public.document_invitation_links l
  JOIN public.documents d ON d.id = l.document_id
  JOIN public.profiles p ON p.id = d.owner_id
  WHERE auth.uid() IS NOT NULL
    AND l.invitation_kind = 'targeted'
    AND l.target_email = lower(COALESCE(auth.jwt() ->> 'email', ''))
    AND l.revoked_at IS NULL AND l.used_count = 0
    AND (l.expires_at IS NULL OR l.expires_at > timezone('utc', now()))
  ORDER BY l.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_my_document_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.document_invitation_links%ROWTYPE;
  member_id uuid;
  queued_count integer := 0;
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
  END IF;

  UPDATE public.document_invitation_links SET used_count = 1, updated_at = timezone('utc', now())
  WHERE id = link_record.id;

  IF NOT public.check_is_document_owner(link_record.document_id, auth.uid()) THEN
    queued_count := public.upsert_key_provisioning_requests_for_user(
      link_record.document_id, auth.uid(), 1, auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id, 'role', link_record.role,
    'status', 'accepted', 'already_member', already_accepted,
    'requires_key_provisioning', queued_count > 0,
    'key_provisioning_status', CASE WHEN queued_count > 0 THEN 'pending' ELSE 'completed' END,
    'queued_request_count', queued_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_my_document_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_targeted_invitation_recipient(p_invitation_id);
  UPDATE public.document_invitation_links
    SET revoked_at = timezone('utc', now()), updated_at = timezone('utc', now())
    WHERE id = p_invitation_id AND used_count = 0;
  IF NOT FOUND THEN RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_document_collaborators(p_document_id uuid)
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'member_id', dm.id, 'user_id', dm.user_id, 'invited_email', dm.invited_email,
    'nickname', p.nickname, 'email', COALESCE(p.email, dm.invited_email),
    'role', dm.role, 'status', dm.status, 'created_at', dm.created_at, 'updated_at', dm.updated_at
  )
  FROM public.document_members dm LEFT JOIN public.profiles p ON p.id = dm.user_id
  WHERE dm.document_id = p_document_id
    AND public.check_is_document_member(p_document_id, auth.uid())
    AND dm.status = 'accepted'
  ORDER BY CASE dm.role WHEN 'owner' THEN 0 ELSE 1 END, dm.created_at;
$$;

CREATE OR REPLACE FUNCTION public.list_document_pending_invitations(p_document_id uuid)
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', l.id, 'document_id', l.document_id, 'role', l.role,
    'target_email', l.target_email, 'expires_at', l.expires_at, 'created_at', l.created_at
  )
  FROM public.document_invitation_links l
  WHERE l.document_id = p_document_id
    AND public.check_is_document_editor(p_document_id, auth.uid())
    AND l.invitation_kind = 'targeted' AND l.revoked_at IS NULL AND l.used_count = 0
    AND (l.expires_at IS NULL OR l.expires_at > timezone('utc', now()))
  ORDER BY l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.assert_targeted_invitation_recipient(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_document_invitation_link_legacy(uuid, text, timestamp with time zone, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_document_invitation_unchecked(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_document_invitation_link(uuid, text, timestamp with time zone, integer, text, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_document_invitation_link(uuid, text, timestamp with time zone, integer, text, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_document_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_invitation_summary(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_pending_document_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_my_document_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_my_document_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_document_collaborators(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_document_pending_invitations(uuid) TO authenticated;
