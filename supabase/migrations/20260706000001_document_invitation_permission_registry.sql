-- TASK-013: document invitation/share registry and permission RPCs.
-- Raw invitation/share tokens are never persisted; only SHA-256 hashes are stored.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.document_registry_hash(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(extensions.digest(convert_to(_value, 'UTF8'), 'sha256'), 'hex');
$$;

CREATE TABLE IF NOT EXISTS public.document_invitation_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  token_hash text UNIQUE NOT NULL CHECK (char_length(token_hash) = 64),
  invite_code_hash text UNIQUE CHECK (invite_code_hash IS NULL OR char_length(invite_code_hash) = 64),
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  expires_at timestamp with time zone,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer DEFAULT 0 NOT NULL CHECK (used_count >= 0),
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS document_invitation_links_document_id_idx
  ON public.document_invitation_links(document_id);

CREATE INDEX IF NOT EXISTS document_invitation_links_created_by_idx
  ON public.document_invitation_links(created_by);

CREATE TABLE IF NOT EXISTS public.document_share_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  token_hash text UNIQUE NOT NULL CHECK (char_length(token_hash) = 64),
  share_type text DEFAULT 'public' NOT NULL CHECK (share_type IN ('public', 'password')),
  password_hash text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS document_share_tokens_document_id_idx
  ON public.document_share_tokens(document_id);

CREATE INDEX IF NOT EXISTS document_share_tokens_created_by_idx
  ON public.document_share_tokens(created_by);

ALTER TABLE public.document_invitation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select document invitation links as editor"
  ON public.document_invitation_links
  FOR SELECT
  USING (public.check_is_document_editor(document_id, auth.uid()));

CREATE POLICY "Select document share tokens as editor"
  ON public.document_share_tokens
  FOR SELECT
  USING (public.check_is_document_editor(document_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.create_document_invitation_link(
  p_document_id uuid,
  p_role text,
  p_expires_at timestamp with time zone DEFAULT NULL,
  p_max_uses integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
  new_code text;
  inserted_link public.document_invitation_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION '유효하지 않은 역할입니다.';
  END IF;

  IF p_max_uses IS NOT NULL AND p_max_uses <= 0 THEN
    RAISE EXCEPTION '유효하지 않은 초대 조건입니다.';
  END IF;

  IF NOT public.check_is_document_editor(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  FOR attempt IN 1..5 LOOP
    new_token := replace(replace(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+', '-'), '/', '_');
    new_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));

    BEGIN
      INSERT INTO public.document_invitation_links (
        document_id,
        token_hash,
        invite_code_hash,
        role,
        created_by,
        expires_at,
        max_uses
      )
      VALUES (
        p_document_id,
        public.document_registry_hash(new_token),
        public.document_registry_hash(new_code),
        p_role,
        auth.uid(),
        COALESCE(p_expires_at, timezone('utc'::text, now()) + interval '6 hours'),
        p_max_uses
      )
      RETURNING * INTO inserted_link;

      RETURN jsonb_build_object(
        'id', inserted_link.id,
        'document_id', inserted_link.document_id,
        'role', inserted_link.role,
        'token', new_token,
        'invite_code', new_code,
        'expires_at', inserted_link.expires_at,
        'max_uses', inserted_link.max_uses
      );
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION '초대 링크를 생성하지 못했습니다.';
      END IF;
    END;
  END LOOP;

  RAISE EXCEPTION '초대 링크를 생성하지 못했습니다.';
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
  summary jsonb;
BEGIN
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
  LIMIT 1;

  IF NOT FOUND
    OR link_record.revoked_at IS NOT NULL
    OR (link_record.expires_at IS NOT NULL AND link_record.expires_at <= timezone('utc'::text, now()))
    OR (link_record.max_uses IS NOT NULL AND link_record.used_count >= link_record.max_uses)
  THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  SELECT jsonb_build_object(
      'document_id', d.id,
      'document_type', d.type,
      'role', link_record.role,
      'expires_at', link_record.expires_at,
      'destination', t.destination,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'owner_nickname', p.nickname,
      'member_count', (
        SELECT count(*)
        FROM public.document_members dm
        WHERE dm.document_id = d.id
          AND dm.status = 'accepted'
      )
    )
    INTO summary
  FROM public.documents d
  JOIN public.profiles p ON p.id = d.owner_id
  LEFT JOIN public.trips t ON t.id = d.id
  WHERE d.id = link_record.document_id;

  IF summary IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  RETURN summary;
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
  link_record public.document_invitation_links%ROWTYPE;
  member_record public.document_members%ROWTYPE;
  current_email text;
  is_owner boolean;
  already_accepted boolean := false;
  has_active_key boolean := false;
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

  IF already_accepted THEN
    IF NOT is_owner THEN
      SELECT EXISTS (
          SELECT 1
          FROM public.document_keys dk
          WHERE dk.document_id = link_record.document_id
            AND dk.user_id = auth.uid()
            AND dk.revoked_at IS NULL
        )
        INTO has_active_key;
    END IF;

    RETURN jsonb_build_object(
      'document_id', link_record.document_id,
      'role', CASE WHEN is_owner THEN 'owner' ELSE member_record.role END,
      'status', 'accepted',
      'already_member', true,
      'requires_key_provisioning', (NOT is_owner AND NOT has_active_key)
    );
  END IF;

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

  SELECT EXISTS (
      SELECT 1
      FROM public.document_keys dk
      WHERE dk.document_id = link_record.document_id
        AND dk.user_id = auth.uid()
        AND dk.revoked_at IS NULL
    )
    INTO has_active_key;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id,
    'role', member_record.role,
    'status', member_record.status,
    'already_member', false,
    'requires_key_provisioning', NOT has_active_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_document_invitation_link(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.document_invitation_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO link_record
  FROM public.document_invitation_links
  WHERE id = p_invitation_id;

  IF NOT FOUND OR NOT public.check_is_document_editor(link_record.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE public.document_invitation_links
    SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_invitation_id;
END;
$$;

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
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_document_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.document_members%ROWTYPE;
  revoked_key_count integer := 0;
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
  END IF;

  RETURN jsonb_build_object(
    'document_id', target_member.document_id,
    'member_id', target_member.id,
    'user_id', target_member.user_id,
    'revoked_key_count', revoked_key_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_trip_document_member_role(
  p_trip_member_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.trip_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION '유효하지 않은 역할입니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.trip_members
  WHERE id = p_trip_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.trip_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 변경할 수 없습니다.';
  END IF;

  UPDATE public.trip_members
    SET role = p_role
    WHERE id = p_trip_member_id;

  IF target_member.user_id IS NOT NULL THEN
    UPDATE public.document_members
      SET role = p_role,
          updated_at = timezone('utc'::text, now())
      WHERE document_id = target_member.trip_id
        AND user_id = target_member.user_id
        AND status = 'accepted'
        AND role <> 'owner';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_trip_document_member(p_trip_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.trip_members%ROWTYPE;
  revoked_key_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.trip_members
  WHERE id = p_trip_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.trip_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 회수할 수 없습니다.';
  END IF;

  DELETE FROM public.trip_members
    WHERE id = p_trip_member_id;

  IF target_member.user_id IS NOT NULL THEN
    UPDATE public.document_members
      SET status = 'revoked',
          updated_at = timezone('utc'::text, now())
      WHERE document_id = target_member.trip_id
        AND user_id = target_member.user_id
        AND role <> 'owner';

    UPDATE public.document_keys
      SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now()))
      WHERE document_id = target_member.trip_id
        AND user_id = target_member.user_id
        AND revoked_at IS NULL;

    GET DIAGNOSTICS revoked_key_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'document_id', target_member.trip_id,
    'trip_member_id', target_member.id,
    'user_id', target_member.user_id,
    'revoked_key_count', revoked_key_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_document_share_token(
  p_document_id uuid,
  p_share_type text DEFAULT 'public',
  p_password text DEFAULT NULL,
  p_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
  inserted_share public.document_share_tokens%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_share_type NOT IN ('public', 'password') THEN
    RAISE EXCEPTION '유효하지 않은 공유 조건입니다.';
  END IF;

  IF p_share_type = 'password' AND NULLIF(p_password, '') IS NULL THEN
    RAISE EXCEPTION '유효하지 않은 공유 조건입니다.';
  END IF;

  IF NOT public.check_is_document_editor(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  FOR attempt IN 1..5 LOOP
    new_token := replace(replace(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+', '-'), '/', '_');

    BEGIN
      INSERT INTO public.document_share_tokens (
        document_id,
        token_hash,
        share_type,
        password_hash,
        created_by,
        expires_at
      )
      VALUES (
        p_document_id,
        public.document_registry_hash(new_token),
        p_share_type,
        CASE
          WHEN p_share_type = 'password' THEN extensions.crypt(p_password, extensions.gen_salt('bf'))
          ELSE NULL
        END,
        auth.uid(),
        p_expires_at
      )
      RETURNING * INTO inserted_share;

      RETURN jsonb_build_object(
        'id', inserted_share.id,
        'document_id', inserted_share.document_id,
        'share_token', new_token,
        'share_type', inserted_share.share_type,
        'expires_at', inserted_share.expires_at
      );
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION '공유 토큰을 생성하지 못했습니다.';
      END IF;
    END;
  END LOOP;

  RAISE EXCEPTION '공유 토큰을 생성하지 못했습니다.';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_document_share_token_summary(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record public.document_share_tokens%ROWTYPE;
  summary jsonb;
BEGIN
  IF NULLIF(p_share_token, '') IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  SELECT *
    INTO share_record
  FROM public.document_share_tokens
  WHERE token_hash = public.document_registry_hash(p_share_token)
  LIMIT 1;

  IF NOT FOUND
    OR share_record.revoked_at IS NOT NULL
    OR (share_record.expires_at IS NOT NULL AND share_record.expires_at <= timezone('utc'::text, now()))
  THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  SELECT jsonb_build_object(
      'document_id', d.id,
      'document_type', d.type,
      'share_type', share_record.share_type,
      'expires_at', share_record.expires_at,
      'destination', t.destination,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'owner_nickname', p.nickname
    )
    INTO summary
  FROM public.documents d
  JOIN public.profiles p ON p.id = d.owner_id
  LEFT JOIN public.trips t ON t.id = d.id
  WHERE d.id = share_record.document_id;

  IF summary IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  RETURN summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_document_share_token(
  p_share_token text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record public.document_share_tokens%ROWTYPE;
  summary jsonb;
BEGIN
  IF NULLIF(p_share_token, '') IS NULL OR NULLIF(p_password, '') IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  SELECT *
    INTO share_record
  FROM public.document_share_tokens
  WHERE token_hash = public.document_registry_hash(p_share_token)
  LIMIT 1;

  IF NOT FOUND
    OR share_record.revoked_at IS NOT NULL
    OR (share_record.expires_at IS NOT NULL AND share_record.expires_at <= timezone('utc'::text, now()))
    OR share_record.share_type <> 'password'
    OR share_record.password_hash IS NULL
    OR share_record.password_hash <> extensions.crypt(p_password, share_record.password_hash)
  THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  SELECT jsonb_build_object(
      'document_id', d.id,
      'document_type', d.type,
      'share_type', share_record.share_type,
      'expires_at', share_record.expires_at,
      'destination', t.destination,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'owner_nickname', p.nickname
    )
    INTO summary
  FROM public.documents d
  JOIN public.profiles p ON p.id = d.owner_id
  LEFT JOIN public.trips t ON t.id = d.id
  WHERE d.id = share_record.document_id;

  IF summary IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  RETURN summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_document_share_token_plans(
  p_share_token text,
  p_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record public.document_share_tokens%ROWTYPE;
  plans_payload jsonb;
BEGIN
  IF NULLIF(p_share_token, '') IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  SELECT *
    INTO share_record
  FROM public.document_share_tokens
  WHERE token_hash = public.document_registry_hash(p_share_token)
  LIMIT 1;

  IF NOT FOUND
    OR share_record.revoked_at IS NOT NULL
    OR (share_record.expires_at IS NOT NULL AND share_record.expires_at <= timezone('utc'::text, now()))
  THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
  END IF;

  IF share_record.share_type = 'password' THEN
    IF NULLIF(p_password, '') IS NULL
      OR share_record.password_hash IS NULL
      OR share_record.password_hash <> extensions.crypt(p_password, share_record.password_hash)
    THEN
      RAISE EXCEPTION '유효하지 않거나 만료된 공유입니다.';
    END IF;
  END IF;

  SELECT COALESCE(
      jsonb_agg(
        to_jsonb(plan_row) || jsonb_build_object(
          'plan_urls',
          COALESCE(url_rows.urls, '[]'::jsonb)
        )
        ORDER BY plan_row.start_datetime_local ASC NULLS LAST, plan_row.created_at ASC
      ),
      '[]'::jsonb
    )
    INTO plans_payload
  FROM public.plans plan_row
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(to_jsonb(pu) ORDER BY pu.created_at ASC), '[]'::jsonb) AS urls
    FROM public.plan_urls pu
    WHERE pu.plan_id = plan_row.id
  ) url_rows ON true
  WHERE plan_row.trip_id = share_record.document_id;

  RETURN plans_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_document_share_token(p_share_token_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record public.document_share_tokens%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO share_record
  FROM public.document_share_tokens
  WHERE id = p_share_token_id;

  IF NOT FOUND OR NOT public.check_is_document_editor(share_record.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE public.document_share_tokens
    SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_share_token_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.document_registry_hash(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_document_invitation_link(uuid, text, timestamp with time zone, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_invitation_summary(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_document_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_document_invitation_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_document_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_document_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trip_document_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_trip_document_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_document_share_token(uuid, text, text, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_share_token_summary(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_document_share_token(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_share_token_plans(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_document_share_token(uuid) TO authenticated;
