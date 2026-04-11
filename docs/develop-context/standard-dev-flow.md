# 표준 개발 워크플로우

OnVoy 프로젝트의 모든 작업에 적용되는 공식 개발 프로세스를 정의한다.
모든 에이전트와 작업에 예외 없이 적용되며, 위반 시 작업 실패로 간주한다.

---

## 1. 분석 및 이슈 등록

- 작업 전 `docs/develop-context/` 문서를 반드시 읽어 프로젝트 컨텍스트를 파악한다
- 사용자의 요청을 분석하고 구현 방향을 설정한다
- 복잡한 작업(파일 5개 이상 변경, DB 스키마 변경, 새 도메인 추가) 시 `implementation_plan.md`를 작성하여 **사용자 승인**을 받는다
- `gh` CLI를 사용하여 **Issue**를 생성한다
  - **필수**: `.claude/settings.local.json`의 `GH_TOKEN`을 환경변수로 지정하여 `ysjee141` 계정 사용

## 2. 로컬 기반 개발 (LOCAL FIRST) — 절대 규칙

- `develop` 브랜치를 최신화한 후 이를 기준으로 feature 브랜치를 생성한다
  ```bash
  git checkout develop && git pull origin develop
  # develop이 없으면 main에서 생성하고 최신화
  git checkout -b feature/[issue-title]-[issue-number]
  ```
- **모든 작업과 커밋은 로컬 브랜치에서만 진행한다**
- **원격 푸시 금지**: 작업 완료 + 로컬 검증이 끝나기 전까지 push하지 않는다
- **`develop`/`main` 직접 커밋 금지**
- **상시 충돌 예방**: 작업 중 주기적으로 `git fetch origin develop && git merge origin/develop`을 수행한다

## 3. 필수 검증 (Mandatory Verification)

- **빌드 검증**:
  - **Web**: `pnpm build` 실행하여 프로덕션 빌드 성공 확인
  - **Mobile**: `pnpm build:mobile` 실행하여 모바일 빌드 성공 확인
  - 빌드 에러 발생 시 **반드시 해결 후** 다음 단계로 진행한다
- **사전 병합 테스트**: PR 생성 전 로컬에서 `git merge develop`을 시도하여 충돌 없음을 확인한다
- `walkthrough.md`를 통해 작업 내용과 결과를 사용자에게 보고한다

## 4. PR 생성 규칙

- **Base Branch**: `develop` (main 직접 PR 금지)
- PR 본문에 `Resolves #NN` 또는 `Close #NN`으로 이슈 자동 연동
- **PR 생성까지만 수행** — 승인 및 머지는 사용자가 직접 진행한다
- 별도 요청 없이 절대 머지하지 않는다
- **GitHub 인증**: `gh` CLI 및 `git push` 시 `.claude/settings.local.json`의 `GH_TOKEN`을 환경변수로 반드시 지정 (`ysjee141` 계정)

## 5. 배포 (Release)

- 배포 시점에 `develop -> main` Release PR을 생성한다
- 최종 머지는 사용자가 진행한다

---

## 전체 흐름 요약

```
분석 -> 이슈 등록 -> 계획 승인 -> 구현 -> 검증 -> Walkthrough -> PR
```

| 단계 | 필수 산출물 |
|------|-----------|
| 분석 | 영향 범위 파악, 구현 계획 (복잡 시 `implementation_plan.md`) |
| 이슈 등록 | GitHub Issue + feature 브랜치 |
| 구현 | 로컬 브랜치에서의 코드 변경 |
| 검증 | `pnpm build` + `pnpm build:mobile` 성공 |
| Walkthrough | `walkthrough.md` 작업 보고 |
| PR | Base=`develop`, `Resolves #NN` 포함 |
