# Operational Rules & Guidelines

OnVoy 프로젝트에 참여하는 모든 AI 모델은 본 문서에 정의된 행동 규칙을 반드시 숙지하고 준수해야 합니다. 

---

## 1. 🔄 Standard Development Workflow

모든 작업은 플랫폼(Web/Mobile)에 관계없이 다음 순서를 엄격히 따릅니다.

1.  **연구 및 분석 (Research)**: 작업 전 소스 코드를 면밀히 분석합니다.
2.  **구현 계획 승인 (Implementation Plan)**: 복잡한 작업 시 반드시 `implementation_plan.md`를 작성하여 사용자 승인을 받습니다.
3.  **이슈 등록 (GitHub Issue)**: GitHub MCP를 사용하여 이슈를 생성합니다.
4.  **로컬 브랜치 생성**: `develop` 브랜치를 기준으로 `feature/[issue-title]-[issue-number]` 형식의 브랜치를 생성합니다.
5.  **검증 (Verification)**: 
    - **Web**: `pnpm build`를 통해 빌드 무결성을 확인합니다.
    - **Mobile**: `pnpm build:mobile` 후 `npx cap sync`를 통해 네이티브 정적 자산 동기화를 확인합니다.
6.  **PR 생성 (Pull Request)**: `develop` 브랜치를 대상으로 PR을 생성하며, 본문에 `Resolves #NN`, `Close #NN` 문구를 포함하여 이슈를 자동 연동합니다.

---

## 2. 🔐 Security & RLS Principles

데이터베이스 접근 정책(RLS) 수립 시 다음 3단계를 반드시 준수하십시오.

1.  **Enable RLS**: `ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;`를 최우선 실행합니다.
2.  **Owner Policy**: 사용자 본인의 데이터(`user_id = auth.uid()`)에 대해서만 모든 권한을 주는 정책을 먼저 생성합니다.
3.  **Shared Policy**: 협업 및 공개 기능이 필요한 경우, `collaborators` 테이블 등 관계형 체크를 통해 접근 권한을 확장합니다.

---

## 3. 🎨 Design DNA & Aesthetics

OnVoy의 디자인 가치와 브랜드 아이デン티티를 훼손하지 마십시오.

- **Brand Color**: **Cobalt Blue (#2563EB)**가 프로젝트의 상징색입니다.
- **Legacy Removal**: 과거의 민트색(#2EC4B6) 코드가 발견될 경우 즉시 코발트 블루로 변경합니다.
- **Premium UI**: Framer Motion을 활용한 부드러운 전환과 `Safe Area`를 고려한 모바일 최적화 레이아웃을 지향합니다.

---

## 4. 🧠 Antigravity Rules (AI Special)

- **맥락 확인**: 작업을 시작하기 전 반드시 `docs/develop-context/` 폴더의 모든 문서를 읽고 지식을 최신화하십시오.
- **CORS & Http**: 모바일 환경 구현 시 `CapacitorHttp` 활용 여부를 항상 검토하십시오.
- **설명 최소화**: 코드 변경 후에는 요점만 간략히 설명하고, 상세 내역은 아티팩트(`walkthrough.md`)를 활용하십시오.

---

> [!WARNING]
> 본 가이드라인을 어기는 것은 프로젝트의 일관성을 해치는 심각한 위험으로 간주됩니다. 불확실할 경우 항상 질문하십시오.
