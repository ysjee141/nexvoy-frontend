# OnVoy Option C 재개발 — 문서 인덱스

> 상위 플랜: `docs/plans/PLAN-007-option-c-rebuild.md`
> 브랜치: `docs/rebuild-option-c`
> 관련 ADR: ADR-007 ~ ADR-010

---

## Phase 문서

| 문서 | 내용 |
|------|------|
| [phase-0-monorepo.md](./phase-0-monorepo.md) | Monorepo 골격 + 공유 패키지 (`@nexvoy/types`, `@nexvoy/core`) |
| [phase-1-web.md](./phase-1-web.md) | nexvoy-web — Next.js SSR 구축 |
| [phase-2-app.md](./phase-2-app.md) | nexvoy-app — React Native/Expo 구축 |
| [phase-3-integration.md](./phase-3-integration.md) | 통합 및 안정화 (Universal Link, Sentry, 스토어) |

## ADR 목록

| ADR | 제목 | 상태 |
|-----|------|------|
| [ADR-007](../../adrs/ADR-007-option-c-platform-split.md) | 웹/앱 완전 분리 아키텍처 채택 | 제안됨 |
| [ADR-008](../../adrs/ADR-008-pnpm-monorepo.md) | pnpm Monorepo 구조 채택 | 제안됨 |
| [ADR-009](../../adrs/ADR-009-expo-react-native.md) | Capacitor → React Native/Expo 전환 | 제안됨 |
| [ADR-010](../../adrs/ADR-010-shared-packages.md) | `@nexvoy/types`·`@nexvoy/core` 공유 패키지 전략 | 제안됨 |

## 전체 일정 요약

```
W1   ~ W1.5  Phase 0 — Monorepo + 공유 패키지
W2   ~ W6    Phase 1 — nexvoy-web (Next.js SSR)
W7   ~ W14   Phase 2 — nexvoy-app (Expo RN)
W15  ~ W17   Phase 3 — 통합 및 안정화
```

## Phase 게이트 요약

| 게이트 | 조건 |
|--------|------|
| P0 → P1 | `packages/types`·`packages/core` 컴파일 통과 |
| P1 → P2 | `pnpm --filter nexvoy-web build` + Vercel 배포 + 핵심 3페이지 Playwright 그린 |
| P2 → P3 | EAS development build 실기기에서 인증→여행생성→플랜추가 완주 |
| 완료 | 양 플랫폼 E2E 그린 + Sentry 연결 + TestFlight 업로드 |
