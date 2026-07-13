# TASK-032: Mobile Full Document-primary Transition

## 목적

Mobile 제품 화면의 핵심 기능을 Local-first document-primary repository로 전환하고, Mobile P2P/runtime 부품을
실제 화면 lifecycle에 연결한다.

## 범위

- Mobile 준비물 CRUD document-primary 전환
- Mobile 일정 CRUD document-primary 전환
- Mobile 템플릿 적용/관리 전환
- Mobile 동행자 초대/수락/거부/권한 UX 정리
- Mobile local document persistence 정리
- `connectMobileP2PPeer()` 화면 lifecycle 연결
- Mobile P2P status UI
- foreground/background cleanup/reconnect 연결

제외:

- Web 화면 전환
- full integration test suite
- store 배포 작업

## 선행 조건

- `TASK-029-full-local-first-product-scope-adr.md`
- `TASK-030-document-primary-repository-layer.md`
- `TASK-031-web-full-document-primary-transition.md`

## 변경 대상

- `apps/mobile/app/trip/[id].tsx`
- `apps/mobile/app/join.tsx`
- `apps/mobile/app/(tabs)/templates.tsx`
- `apps/mobile/lib/local-first/`
- `packages/core/src/repositories/`

## 구현 단계

1. Mobile repository factory를 document-primary로 구성한다.
2. trip detail의 일정/준비물 read path를 materialized document read model로 전환한다.
3. 일정/준비물 mutation을 document repository로 전환한다.
4. 템플릿 적용 결과가 TripDocumentV1 mutation으로 들어가도록 연결한다.
5. 초대 수락 후 restore/key provisioning 완료 상태와 document availability UX를 정리한다.
6. `connectMobileP2PPeer()`를 trip document lifecycle에 연결한다.
7. AppState background/foreground cleanup/reconnect를 실제 active connection에 연결한다.
8. Android preview APK와 iOS build에서 native runtime smoke를 수행한다.

## 데이터 호환성 고려사항

- Mobile AsyncStorage에 저장된 Yjs update key와 namespace 정책을 확정한다.
- 기존 Supabase row 기반 화면 상태와 document read model shape 차이를 흡수해야 한다.
- offline mutation이 앱 종료 후에도 durable해야 한다.

## 검증 방법

- `pnpm --filter nexvoy-app typecheck`
- `pnpm --filter nexvoy-app lint`
- `pnpm build:mobile`
- Android preview APK 설치/실행/Logcat 검증
- Mobile에서 준비물/일정/템플릿/초대 수락 기능 수동 smoke

## 롤백 방법

- Mobile repository factory를 legacy Supabase mode로 되돌린다.
- P2P 자동 연결은 feature flag로 비활성화한다.

## 완료 조건

- Mobile 핵심 기능이 document-primary repository를 통해 동작한다.
- Mobile 화면에서 P2P connection lifecycle이 실제로 연결된다.
- Mobile이 Web과 같은 Local-first product path에 올라간다.
