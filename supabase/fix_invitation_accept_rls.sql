-- 초대받은 사용자가 자신의 초대를 수락(Update)할 수 있도록 허용하는 정책 추가

-- 기존에 'Manage members as owner'만 있어서 초대받은 사람이 업데이트를 못하던 문제를 해결합니다.

DROP POLICY IF EXISTS "Invited users can accept invitations" ON public.trip_members;

CREATE POLICY "Invited users can accept invitations" ON public.trip_members
  FOR UPDATE 
  USING (
    invited_email = (auth.jwt() ->> 'email') AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid() AND status = 'accepted'
  );

-- (참고) 삭제 권한도 필요할 수 있으나(거절 등), 일단 수락을 위해 UPDATE 권한을 최우선으로 추가합니다.
