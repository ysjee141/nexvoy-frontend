# TASK-030: Document-primary Repository Layer

## 목적

Web/Mobile 화면이 Supabase row, Yjs, WebRTC, backup queue를 직접 알지 않도록 제품 전체 기능의
document-primary Repository contract를 만든다. 이 task는 이후 Web/Mobile 화면 전환의 기반이다.

## 범위

- core repository contract 정의/확장
  - TripRepository
  - PlanRepository
  - ChecklistRepository
  - TemplateRepository
  - MemberRepository
- `TripDocumentV1` 기반 read/write helper 정리
- document mutation 결과로 Yjs update를 생성하는 공통 writer 설계
- repository-level publish hook
  - P2P fast path publish
  - backup queue enqueue
- Web/Mobile platform adapter가 주입해야 하는 storage/crypto/network boundary 정의

제외:

- Web/Mobile 화면 코드 전환
- P2P peer discovery
- 실제 backup queue productization

## 선행 조건

- `TASK-029-full-local-first-product-scope-adr.md`

## 변경 대상

- `packages/core/src/repositories/`
- `packages/core/src/local-first/`
- `packages/core/src/sync/`
- `apps/web/lib/local-first/`
- `apps/mobile/lib/local-first/`

## 구현 단계

1. ADR-013 결정에 맞춰 repository interface를 정리한다.
2. plan/checklist/template/member mutation을 document mutation으로 표현한다.
3. mutation 결과가 encoded Yjs update를 반환하도록 공통 writer contract를 만든다.
4. Web IndexedDB와 Mobile AsyncStorage/향후 SQLite adapter가 같은 contract를 구현하도록 한다.
5. legacy repository는 migration source/fallback adapter로 분리한다.

## 데이터 호환성 고려사항

- 기존 row id는 document entity id로 유지한다.
- checklist/plans/templates/members의 timestamp/order/conflict policy를 명시한다.
- viewer는 write mutation contract에서 차단되어야 한다.

## 검증 방법

- core tests로 각 repository mutation이 TripDocumentV1 read model에 반영되는지 확인한다.
- legacy row bundle -> document -> repository read model 결과가 기존 UI shape와 호환되는지 확인한다.
- `packages/core`에 Web/RN/Supabase client API가 들어가지 않는지 확인한다.

## 롤백 방법

- 신규 document-primary repository를 feature flag 뒤에 두고 legacy repository를 유지한다.

## 완료 조건

- Web/Mobile이 공유할 document-primary repository contract가 확정된다.
- 준비물/일정/템플릿/멤버 mutation을 document mutation으로 표현할 수 있다.
- 이후 화면 전환 TASK가 repository contract만 보고 진행 가능하다.

## 구현 결과

- `TemplateDocumentV1` boundary와 Yjs helper를 추가했다.
- `DocumentMutationResult`, `DocumentMutationPublisher`, `LocalDocumentStore` contract를 추가했다.
- Trip/Plan/Checklist/Template/Member document-primary repository contract와 core factory를 추가했다.
- 준비물/일정/템플릿/멤버 mutation을 순수 document mutation writer로 표현했다.
- 신규 Supabase migration/query 파일은 없다. 실행해야 할 SQL 파일도 없다.
