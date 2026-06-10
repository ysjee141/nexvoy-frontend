-- checklist_items.is_private 컬럼 추가
-- 운영 DB에는 이미 존재하나 로컬 마이그레이션에 누락된 스키마 드리프트 수정
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;
