# 🤖 OnVoy AI 가이드 (AI Guide)

이 가이드는 **OnVoy** 프로젝트에 참여하는 AI 코딩 어시스턴트(Antigravity 등)를 위한 기술 문서입니다. 프로젝트의 구조, 코딩 스타일, 그리고 가장 중요한 **표준 개발 프로세스**를 정의합니다.

> [!IMPORTANT]
> 모든 AI 어시스턴트는 작업을 시작하기 전 본 문서를 숙지해야 하며, 특히 **표준 개발 프로세스**를 엄격히 준수해야 합니다.

## 📚 문서 목차

1.  **[가이드 개요 및 프로젝트 소개](file:///Users/ysjee141/mySources/travel-pack/docs/ai-guide/README.md)** (현재 문서)
2.  **[코딩 표준 및 스타일 가이드](file:///Users/ysjee141/mySources/travel-pack/docs/ai-guide/coding-standards.md)**: Panda CSS, Next.js App Router, TypeScript 규칙.
3.  **[아키텍처 및 핵심 워크플로우](file:///Users/ysjee141/mySources/travel-pack/docs/ai-guide/architecture.md)**: 프로젝트 구조 및 **표준 개발 프로세스** 상세 설명.
4.  **[Supabase 활용 가이드](file:///Users/ysjee141/mySources/travel-pack/docs/ai-guide/supabase-guide.md)**: 인증, 데이터베이스 인터페이스, RLS 정책.
5.  **[Capacitor 및 모바일 개발 가이드](file:///Users/ysjee141/mySources/travel-pack/docs/ai-guide/capacitor-guide.md)**: 네이티브 기능 연동 및 모바일 빌드 프로세스.

## 🚀 온보딩 (Onboarding for AI)

이 프로젝트에서 작업을 수행할 때 반드시 다음 단계를 거치십시오:

1.  **컨텍스트 이해**: `README.md`와 본 가이드를 읽고 OnVoy의 목적과 기술 스택을 파악합니다.
2.  **워크플로우 준수**: `.agents/workflows/standard-dev-flow.md`에 정의된 **표준 개발 프로세스**를 모든 작업의 기본으로 삼습니다.
    - 리서치 -> 구현 계획(Implementation Plan) -> 작업 리스트(Task List) -> 검증 -> Walkthrough -> PR 생성.
3.  **코드 품질**: Panda CSS를 사용한 원자적 디자인(Atomic Design)을 지향하며, 타입 안정성을 최우선으로 합니다.

## 🛠 주요 기술 스택 일람

- **Core**: Next.js 16 (App Router), React 19
- **Styling**: Panda CSS
- **State**: Zustand
- **Backend/Auth**: Supabase (Auth, PostgreSQL, Storage, RLS)
- **Native**: Capacitor (iOS, Android)
- **Monitoring**: Sentry
