# TASK-033: Backup Sync Productization

## 목적

P2P가 없는 상황에서도 Web/Mobile 모든 핵심 기능 변경이 eventually sync 되도록 Supabase encrypted backup
snapshot/update 경로를 제품 동기화 경로로 완성한다.

## 범위

- 모든 document-primary mutation 후 backup update enqueue
- Web IndexedDB pending update queue
- Mobile local pending update queue
- foreground/startup/network restore/pull
- snapshot compaction 기준
- conflict policy 검증
- restore freshness UX
- failed backup/retry observability

제외:

- P2P peer discovery
- 화면 CRUD 전환 자체

## 선행 조건

- `TASK-030-document-primary-repository-layer.md`
- `TASK-031-web-full-document-primary-transition.md`
- `TASK-032-mobile-full-document-primary-transition.md`

## 변경 대상

- `packages/core/src/sync/`
- `packages/core/src/supabase/backupRepository.ts`
- `apps/web/lib/local-first/`
- `apps/mobile/lib/local-first/`
- Web/Mobile foreground/network lifecycle integration

## 구현 단계

1. mutation output Yjs update를 backup queue에 넣는 공통 hook을 만든다.
2. Web pending queue를 IndexedDB에 저장한다.
3. Mobile pending queue를 AsyncStorage 또는 ADR-013 결정 저장소에 저장한다.
4. foreground/startup/network recovery 시 upload/pull/restore를 실행한다.
5. snapshot compaction 정책을 정의한다.
6. restore result를 화면 UX에 연결한다.
7. backup 실패는 generic reason code로만 관측한다.

## 데이터 호환성 고려사항

- encrypted payload만 서버에 저장한다.
- document key provisioning이 완료되지 않은 member는 restore pending 상태여야 한다.
- viewer는 backup upload를 할 수 없어야 한다.

## 검증 방법

- offline mutation 후 reload/앱 재시작에도 pending update가 유지되는지 확인한다.
- A 변경 후 종료, B 나중 진입 시 backup restore/pull로 반영되는지 확인한다.
- owner/editor/viewer 권한별 backup upload/read 제한 확인.
- raw document content/key material이 로그/analytics에 남지 않는지 확인.

## 롤백 방법

- backup queue upload를 feature flag로 끄고 local-only/P2P-only path로 되돌린다.
- 기존 encrypted snapshot tables는 유지한다.

## 완료 조건

- P2P 없이도 Web/Mobile 전체 기능 변경이 eventually sync 된다.
- offline write 후 앱/브라우저 종료 시나리오가 데이터 손실 없이 처리된다.
- Closed Beta에서 cross-device restore를 제품 기능으로 검증할 수 있다.
