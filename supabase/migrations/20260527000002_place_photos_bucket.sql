-- place-photos Storage 버킷 + RLS 정책
-- 경로 규칙: place-photos/{user_id}/{trip_id}/{plan_id}_{placeIdHash8}.jpg
-- SELECT: 누구나(public) / INSERT, UPDATE, DELETE: 본인 폴더만(auth.uid())

-- 1) 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('place-photos', 'place-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) RLS 정책: 기존 정책 제거 후 재생성 (idempotent)
DROP POLICY IF EXISTS "place_photos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "place_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "place_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "place_photos_delete_own" ON storage.objects;

-- 2-1) SELECT: 누구나 (public 버킷이므로 모든 사용자가 조회 가능)
CREATE POLICY "place_photos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'place-photos');

-- 2-2) INSERT: 본인 폴더에만 업로드 가능
CREATE POLICY "place_photos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'place-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2-3) UPDATE: 본인 폴더 객체만 수정 가능
CREATE POLICY "place_photos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'place-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'place-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2-4) DELETE: 본인 폴더 객체만 삭제 가능
CREATE POLICY "place_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'place-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
