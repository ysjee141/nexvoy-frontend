-- plans 테이블에 Google Places 기반 장소 식별/좌표 컬럼 추가
-- 웹 NewPlanModal 및 RN 일정 등록 흐름에서 장소 선택 결과를 영구 저장한다.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;

COMMENT ON COLUMN public.plans.google_place_id IS
  'Google Places place_id. 장소 재조회, 사진 복구, 지도 연동에 사용.';
COMMENT ON COLUMN public.plans.location_lat IS
  'Google Places 상세 조회에서 얻은 위도.';
COMMENT ON COLUMN public.plans.location_lng IS
  'Google Places 상세 조회에서 얻은 경도.';
