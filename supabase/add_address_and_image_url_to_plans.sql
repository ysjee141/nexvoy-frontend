-- plans 테이블에 누락된 address 및 image_url 컬럼 추가
-- user의 요청에 따라 상세 주소 및 구글 맵 이미지 URL 저장 공간 확보

ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.plans.address IS '일정의 상세 주소 정보';
COMMENT ON COLUMN public.plans.image_url IS '일정의 대표 이미지 (구글 맵 제공 URL 등)';
