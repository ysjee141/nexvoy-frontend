# 🏗️ OnVoy 프로젝트 구조 및 아키텍처

OnVoy의 효율적인 개발과 유지보수를 위해 AI 어시스턴트가 반드시 숙지해야 할 프로젝트 구조와 워크플로우를 설명합니다.

## 1. 📂 폴더 구조 안내

```text
/
├── .agents/          # AI를 위한 워크플로우 정의 (중요!)
├── docs/             # 프로젝트 문서 (현재 문서 포함)
├── src/              # 소스 코드 메인 디렉토리
│   ├── app/          # Next.js App Router (Page, Layout)
│   ├── components/   # UI 공통 컴포넌트
│   ├── hooks/        # 커스텀 React Hooks
│   ├── services/     # 외부 API 및 Supabase 통신 로직 (중앙화)
│   ├── stores/       # Zustand 상태 저장소
│   ├── utils/        # 공통 유틸리티 함수
│   └── assets/       # 이미지, 아이콘 등 정적 자산
├── supabase/         # Supabase 마이그레이션 및 설정
├── android/          # Capacitor 기반 Android 네이티브 프로젝트
└── ios/              # Capacitor 기반 iOS 네이티브 프로젝트
```

## 2. 🔄 핵심 워크플로우 (중요!)

사용자의 피드백에 따라 **표준 개발 프로세스(Standard Dev Flow)**를 가장 우선적으로 준수해야 합니다.

### [필독] 표준 개발 프로세스
이 프로세스는 `/Users/ysjee141/mySources/travel-pack/.agents/workflows/standard-dev-flow.md` 에 상세히 명시되어 있으며, AI는 모든 작업 시 이를 **절대적으로 준수**해야 합니다.

1.  **리서치(Research)**: `view_file` 등을 통해 관련 코드와 문서를 충분히 분석합니다.
2.  **구현 계획(Implementation Plan)**: `implementation_plan.md` 아티팩트를 작성하고 사용자의 승인을 받습니다. (필수!)
3.  **작업 리스트(Task List)**: `task.md` 에 작업 항목을 나열하고 진행 상황(`[/]`, `[x]`)을 실시간으로 업데이트합니다.
4.  **검증(Verification)**: 빌드 확인(`pnpm build`, `pnpm build:mobile`) 및 기능 테스트를 수행합니다.
5.  **마무리(Walkthrough)**: `walkthrough.md` 를 작성하여 변경 사항을 요약하고 보고합니다.

> [!CAUTION]
> 위 프로세스를 누락하는 것은 작업의 실패로 간주됩니다. 특히 **구현 계획 승인** 단계를 절대 건너뛰지 마십시오.

## 3. 🧠 상태 관리 전략 (Zustand)

- **UI Store**: 모달, 사이드바 등 UI의 전역 상태를 관리합니다.
- **Data Store**: 네트워크 상태, 사용자 프로필 정보 등 비즈니스 데이터를 관리합니다.
- **Persistence**: 필요한 경우 `zustand/middleware`의 `persist` 기능을 사용하여 브라우저 저장소(LocalStorage)에 데이터를 유지합니다.

## 4. 🌐 플랫폼 아키텍처

OnVoy는 하나의 코드베이스로 웹과 모바일을 동시에 지원합니다.
- **Web**: Next.js App Router 기반의 풀 렌더링.
- **Native (Capacitor)**: 웹 뷰를 감싸는 하이브리드 방식.
- **Bridge**: `CapacitorHttp` 등을 통해 네이티브 기능을 호출하며, 웹환경과 네이티브 환경의 차이를 서비스 레이어(`src/services`)에서 추상화합니다.
