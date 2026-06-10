-- 1. 기존 '소유자 전용' 정책 제거
DROP POLICY IF EXISTS "Users can manage plan urls for their trips" ON public.plan_urls;

-- 2. 조회(SELECT) 정책 추가: 여행 소유자, 멤버(Accepted), 또는 공개 공유 링크 대상에게 허용
CREATE POLICY "Allow members and public to view plan urls" ON public.plan_urls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = public.plan_urls.plan_id AND (
        public.check_is_trip_owner(p.trip_id, auth.uid()) OR 
        public.check_is_trip_member(p.trip_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.trip_shares ts WHERE ts.trip_id = p.trip_id AND ts.share_type = 'public')
      )
    )
  );

-- 3. 관리(ALL) 정책 추가: 소유자 또는 편집자(Owner, Editor) 권한을 가진 사용자에게 허용
CREATE POLICY "Allow editors to manage plan urls" ON public.plan_urls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = public.plan_urls.plan_id AND (
        public.check_is_trip_owner(p.trip_id, auth.uid()) OR 
        public.check_is_trip_editor(p.trip_id, auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = public.plan_urls.plan_id AND (
        public.check_is_trip_owner(p.trip_id, auth.uid()) OR 
        public.check_is_trip_editor(p.trip_id, auth.uid())
      )
    )
  );
