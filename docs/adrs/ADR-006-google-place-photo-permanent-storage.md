# ADR-006: Google Place Photo 영구 저장 및 On-demand 복구

- 상태: 제안됨
- 결정일: 2026-05-27
- 결정자: ysjee141
- 관련 이슈: #184

## 컨텍스트

Google Maps Places Photo API의 CDN URL은 만료되어 일정 시간 후 403을 반환한다.
OnVoy는 현재 해당 URL을 `plans.image_url`에 그대로 저장하고 있어 일정 목록/상세에서 이미지가 깨지는 문제가 발생한다.
오프라인 캐시(`DownloadService`) 또한 만료 URL을 그대로 캐싱하여 오프라인에서도 깨진 이미지가 표시될 수 있다.

Google Maps Platform 약관 §3.2.3 (a)는 콘텐츠의 영구 캐싱을 제한하지만,
1인 운영 서비스의 사용자 경험 및 운영 부담을 고려하여 정책적 리스크를 감수하는 결정을 내린다.

## 결정

1. **영구 저장**: 서버가 Google Photo 바이너리를 다운로드하여 Supabase Storage `place-photos` 버킷에 업로드하고, 그 publicUrl을 `plans.image_url`에 저장한다.
2. **photo_reference 보존**: `plans.photo_reference TEXT` 컬럼을 추가하여 재발급/복구의 키로 사용한다.
3. **하이브리드 비동기 처리**: `plans` INSERT는 즉시 완료(`image_url=null`)되고, 이미지 다운로드/업로드/UPDATE는 백그라운드에서 처리한다.
4. **On-demand 복구**: 클라이언트는 `<img onError>`에서 만료/누락을 감지하여 `photo_reference`로 서버에 복구를 요청한다. 동일 plan에 대한 중복 호출은 클라이언트에서 dedup한다(모듈 스코프 `Set` + 5분 cooldown `Map`, 410 응답 시 24시간 cooldown).
5. **Storage 경로/권한**:
   - 경로: `place-photos/{user_id}/{trip_id}/{plan_id}_{placeIdHash8}.jpg`
   - 버킷: public, SELECT는 누구나
   - RLS: INSERT/UPDATE/DELETE는 본인 폴더(`user_id == auth.uid()`)에 한정
6. **Plan 삭제 시 정리**: plan DELETE 흐름에서 동일 폴더의 Storage 객체를 best-effort로 제거한다.

## 대안 비교

- **CDN URL 직접 저장(현행)**: 만료 시 이미지 깨짐. 채택하지 않음.
- **표시 시점 매번 Places API 재요청**: 쿼터/요금/지연 부담. 채택하지 않음.
- **동기 INSERT(저장 완료까지 대기)**: 사용자 대기 시간 증가로 UX 저하. 채택하지 않음.
- **일괄 백필 마이그레이션**: 다수의 만료 토큰으로 효율 낮음. 채택하지 않음.
- **선택안(채택)**: 영구 저장 + 하이브리드 비동기 + on-demand 복구.

## 결과

### 긍정
- 일정 이미지 안정성 확보
- 신규 일정 생성 UX 즉시 완료 유지
- 레거시 데이터 점진적 자동 복구
- Storage 사용 패턴 표준화의 첫 사례 마련 (trip 커버, profile 아바타 등 후속 기능 재사용 가능)

### 부정/감수
- Google Maps Platform 약관 §3.2.3 (a) 캐싱 제한에 대한 위반 가능성 (감수)
- Storage 저장 비용 발생 (현 규모 무시 가능)
- Attribution(저작자 표시) 의무 검토 필요 — 본 ADR에서는 보류, 후속 TODO

## 후속 TODO

- Attribution(`html_attributions`) 표시 정책 검토 및 별도 ADR/이슈로 처리
- 주기 갱신 잡(예: 30~60일 주기) 도입 검토
- Zustand `usePlansStore` 도입으로 콜백 prop chain 축소
- Supabase `Database` 자동 생성 타입 재생성
- `NEXT_PUBLIC_APP_URL` 미설정 가드 (모바일 빌드)
