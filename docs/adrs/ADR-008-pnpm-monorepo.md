# ADR-008: pnpm Monorepo 구조 채택

- 상태: 제안됨
- 결정일: 2026-06-19
- 결정자: ysjee141
- 관련 ADR: ADR-007 (Option C 플랫폼 분리)

---

## 컨텍스트

Option C (웹/앱 완전 분리) 채택 후, 두 앱과 공유 패키지(`@nexvoy/types`, `@nexvoy/core`)를 어떤 저장소 구조로 관리할지 결정해야 한다.

후보는 두 가지다:
1. **pnpm Monorepo** — 단일 저장소에 `apps/web`, `apps/mobile`, `packages/types`, `packages/core`를 모두 포함
2. **별도 저장소** — web/app/core를 각각 독립 저장소로 관리하고 npm 패키지로 공유

현재 `travel-pack`은 pnpm을 패키지 매니저로 사용 중이다.

---

## 결정

**pnpm Monorepo** (`pnpm-workspace.yaml`)를 채택한다.

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

---

## 근거

### 1. 타입 동기화 즉시성

`@nexvoy/types`의 도메인 타입을 변경하면 web/app 양쪽에 `workspace:*` 링크로 즉시 반영된다. 별도 저장소 방식은 버전 퍼블리시 → `package.json` 버전 업 → install 사이클이 필요하다.

### 2. 1인 개발 인지부하 최소화

| 기준 | pnpm Monorepo | 별도 저장소 |
|------|--------------|-----------|
| 타입 변경 → 반영 | 즉시 | 퍼블리시 + 버전 핀 필요 |
| PR 범위 | 단일 PR (web+app+core) | 3개 리포 조율 |
| CI 설정 | 1개 (`--filter` 분기) | 3개 독립 파이프라인 |
| 저장소 수 | 1개 | 3개 |

1인 개발 환경에서 별도 저장소의 버전 퍼블리시/핀 오버헤드는 순손실이다.

### 3. 기존 pnpm 환경 재사용

`travel-pack`이 이미 pnpm을 사용하므로 workspace 설정 이외의 추가 학습 비용이 없다.

### 4. CI 단순화

```yaml
# 단일 CI 파일에서 filter로 분리
- run: pnpm -r --filter "./packages/*" build  # packages 검증
- run: pnpm --filter nexvoy-web build          # 웹 빌드
- run: eas build ...                           # 앱 빌드 (별도 job)
```

---

## 구조

```
nexvoy/
├── pnpm-workspace.yaml
├── package.json              # 루트 scripts (lint, build:all 등)
├── tsconfig.base.json        # 공통 TypeScript 설정
├── .eslintrc.base.json       # 공통 ESLint (no-restricted-imports 포함)
├── packages/
│   ├── types/                # @nexvoy/types
│   └── core/                 # @nexvoy/core
└── apps/
    ├── web/                  # nexvoy-web
    └── mobile/               # nexvoy-app
```

---

## 한계 및 감수사항

- **CI 빌드 시간**: 단일 리포이므로 변경이 없어도 전체 CI가 트리거될 수 있다. `pnpm --filter` + GitHub Actions path filter로 완화.
- **저장소 크기**: iOS 빌드 아티팩트 등이 리포에 포함되지 않도록 `.gitignore` 철저히 관리 필요.

---

## 후속 과제

- 루트 `package.json`에 `"build:all"`, `"lint:all"`, `"typecheck:all"` 편의 스크립트 정의
- Renovate/Dependabot으로 workspace 내 의존성 자동 업데이트 설정
