-- 누락 컬럼 보정: 운영 DB에 존재하나 로컬 마이그레이션에 미반영된 스키마 드리프트 수정
-- checklist_template_items.is_private: 템플릿 아이템 비공개 여부
ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- checklist_items.source_template_name: 템플릿 불러오기 시 출처 템플릿명 (중복 필터 기준)
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS source_template_name TEXT;
