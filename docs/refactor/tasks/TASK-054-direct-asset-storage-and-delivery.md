# TASK-054: Direct Asset Storage and Delivery

- 상태: 구현 완료 (Issue [#364](https://github.com/ysjee141/nexvoy-frontend/issues/364), PR [#365](https://github.com/ysjee141/nexvoy-frontend/pull/365), 로컬 자동 검증 완료 · cleanup 스케줄러 연결과 DEV network 확인은 후속)

## 목적

사진과 asset이 metadata sync 비용을 압도하지 않도록 client-to-Storage 직접 업로드, thumbnail, CDN cache,
orphan cleanup을 정리한다. 앱 API가 binary를 proxy하거나 Trip command에 Base64를 포함하지 않게 한다.

## 범위

- trip/place/profile asset inventory와 저장 정책
- authenticated signed upload 또는 Storage RLS direct upload
- content hash 기반 path와 metadata row
- thumbnail/preview 생성과 responsive delivery
- 삭제 tombstone 이후 orphan cleanup
- cache-control, CDN hit, egress/transform 지표
- Web/Mobile upload/download UX

제외:

- Google Places API 라이선스 정책 변경
- 범용 media editing 기능
- 외부 CDN provider 이전

## 선행 조건

- `TASK-050-web-server-authority-product-cutover.md`
- `TASK-052-mobile-server-authority-product-cutover.md`

## 변경 대상

- `apps/web/app/api/places/photo`
- Web/Mobile asset service 및 UI
- `packages/core/src/supabase/storagePaths.ts`
- `supabase/storage` migration/RLS/function
- asset metadata schema

## 구현 단계

1. 현재 binary proxy, remote fetch, Base64, 원본 반복 download 경로를 inventory한다.
2. account/resource/content hash가 포함된 canonical object path를 정의한다.
3. server는 권한 검증 후 짧은 signed upload 권한 또는 RLS path를 제공하고 client가 Storage로 직접 전송한다.
4. upload 완료 후 metadata command로 asset row/reference를 연결한다.
5. list/card에는 thumbnail만 사용하고 원본은 명시적으로 열 때 요청한다.
6. cache-control과 immutable content hash filename을 적용한다.
7. 취소된 upload, 교체, resource 삭제의 orphan을 retention 후 정리한다.
8. upload/download bytes, thumbnail ratio, CDN hit, 실패율을 관측한다.

## 보안 및 비용 고려사항

- signed URL 수명과 object path를 최소 권한으로 제한한다.
- private trip asset은 membership/revoke 정책을 따라야 한다.
- command/Realtime payload에는 object metadata만 포함하고 binary를 넣지 않는다.
- place photo 저장은 `ADR-006-google-place-photo-permanent-storage.md`의 제공자 정책을 계속 따른다.

## 검증 방법

- Web/Mobile에서 큰 사진 업로드 시 앱 API request body에 binary가 없는지 확인한다.
- viewer/revoked/비멤버의 upload/download가 차단되는지 확인한다.
- list 화면이 원본 대신 thumbnail을 요청하는지 network log로 확인한다.
- 교체/삭제 후 orphan cleanup이 사용 중 object를 삭제하지 않는지 검증한다.

## 롤백 방법

- signed direct upload flag를 끄고 기존 asset path를 임시 사용한다.
- 새 object path와 metadata는 유지해 재전환에 사용한다.

## 완료 조건

- asset binary가 Repository command, Realtime, 앱 API proxy를 통과하지 않는다.
- thumbnail/CDN 정책으로 list/detail egress가 구분된다.
- permission과 orphan lifecycle이 자동 테스트로 고정된다.
