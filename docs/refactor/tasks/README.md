# Local-First Refactor Tasks

이 디렉토리는 Local-first Data Engine 전환 작업의 phase별 실행 문서를 보관한다.

상위 문서:

- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
- `docs/plans/PLAN-008-local-first-architecture-review.md`

## 문서 네이밍

작업 문서는 아래 형식을 사용한다.

```text
TASK-001-checklist-yjs-spike.md
TASK-002-repository-abstraction.md
TASK-003-backup-schema.md
TASK-004-row-document-migration.md
```

## 권장 템플릿

```markdown
# TASK-NNN: 제목

## 목적

## 범위

## 선행 조건

## 변경 대상

## 구현 단계

## 데이터 호환성 고려사항

## 검증 방법

## 롤백 방법

## 완료 조건
```

## 초기 작업 후보

- [ ] `TASK-001-checklist-yjs-spike.md`: 체크리스트 Yjs document 스파이크
- [ ] `TASK-002-mobile-webrtc-feasibility.md`: Expo dev client/EAS Build 기반 RN WebRTC/Yjs provider 검증
- [ ] `TASK-003-repository-abstraction.md`: Supabase query 앞 Repository interface 도입
- [ ] `TASK-004-encrypted-backup-schema.md`: Supabase encrypted document backup schema 및 `document_keys` 설계
- [ ] `TASK-005-row-document-round-trip.md`: 기존 row/document 변환 round-trip 검증
- [ ] `TASK-006-dual-write-detector.md`: dual-write mismatch detector 설계
- [ ] `TASK-007-guest-auth-promotion.md`: Option B 지연 인증 기반 guest local document를 Supabase Auth 계정으로 승격하는 PoC
- [ ] `TASK-008-invitation-permission-registry.md`: 딥 링크/초대 코드와 Supabase document permission registry PoC
- [ ] `TASK-009-notification-metadata.md`: 시간 기반 로컬 알림과 협업 push metadata 분리 PoC
- [ ] `TASK-010-cost-observability.md`: ADR-001~009 결정사항 기반 backup/update/index/notification 비용 관측 지표 설계
