-- plans 테이블에 photo_reference 컬럼 추가
-- Google Places photo_reference 토큰을 보존하여 on-demand 복구 및 백그라운드 업로드의 키로 사용

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS photo_reference TEXT;

COMMENT ON COLUMN public.plans.photo_reference IS
  'Google Places photo_reference 토큰. on-demand 갱신 및 백그라운드 업로드에 사용.';
