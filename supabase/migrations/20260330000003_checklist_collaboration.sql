-- 1. checklist_items 테이블 구조 확장
ALTER TABLE public.checklist_items 
ADD COLUMN IF NOT EXISTS assignment_type text check (assignment_type in ('anyone', 'specific', 'everyone')) default 'anyone' NOT NULL,
ADD COLUMN IF NOT EXISTS assigned_user_id uuid references public.profiles(id);

-- 2. 개별 체크 기록을 위한 checklist_item_user_checks 테이블 신설
CREATE TABLE IF NOT EXISTS public.checklist_item_user_checks (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.checklist_items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(item_id, user_id)
);

-- 3. RLS 설정 (기존 checklist_items와 동일한 로직 적용)
ALTER TABLE public.checklist_item_user_checks ENABLE ROW LEVEL SECURITY;

-- 3-1. 사용자가 조회 권한을 가진 여행의 체크리스트 항목이면 열람 가능
DROP POLICY IF EXISTS "Users can view user checks for accessible trips" ON public.checklist_item_user_checks;
CREATE POLICY "Users can view user checks for accessible trips" ON public.checklist_item_user_checks
  FOR SELECT USING (
    item_id IN (
      SELECT id FROM public.checklist_items 
      WHERE checklist_id IN (
        SELECT id FROM public.checklists 
        WHERE trip_id IN (
          SELECT id FROM public.trips WHERE user_id = auth.uid()
          UNION
          SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 3-2. 사용자가 본인의 체크 내역을 관리(추가/삭제) 가능
DROP POLICY IF EXISTS "Users can manage their own checks" ON public.checklist_item_user_checks;
CREATE POLICY "Users can manage their own checks" ON public.checklist_item_user_checks
  FOR ALL USING (auth.uid() = user_id);

-- 4. 특정인(assigned_user_id) 외 다른 사용자의 checklist_items 업데이트 제한을 위한 정책 보완
-- 이 부분은 애플리케이션 레벨(UI)에서 주로 제어하며, DB 레벨 정책은 기존의 "편집 권한 소유자"를 유지하되
-- 필요한 경우 트리거 등으로 보조할 수 있으나, 이번 개선에서는 애플리케이션 로직을 우선 적용합니다.
