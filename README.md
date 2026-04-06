# ✈️ OnVoy (nexvoy-frontend)

**OnVoy**는 복잡한 여행 계획을 한눈에 정리하고, 현지 시간과 체크리스트를 스마트하게 관리할 수 있도록 돕는 프리미엄 여행 플래너 웹 앱입니다.

![OnVoy UI Mockup](https://via.placeholder.com/800x400.png?text=OnVoy+Smart+Travel+Planner) *<!-- 실제 이미지가 있다면 교체 가능 -->*

## 🤖 AI 어시스턴트를 위한 가이드 (For AI Assistants)

이 프로젝트는 AI 코딩 어시스턴트(Antigravity 등)와의 협업을 적극적으로 지향합니다. AI 어시스턴트는 작업을 시작하기 전 반드시 다음 문서를 확인하십시오.

- **[상세 AI 가이드 (AI Guide)](file:///Users/ysjee141/mySources/travel-pack/docs/ai-guide/README.md)**: 코딩 표준, 아키텍처, **표준 개발 프로세스**가 명시되어 있습니다.

> [!IMPORTANT]
> 모든 개발 작업은 `.agents/workflows/standard-dev-flow.md`에 정의된 프로세스를 엄격히 따라야 합니다.

## ✨ 주요 기능 (Key Features)

- **📅 스마트 일정표 (Weekly Itinerary)**: 주간 캘린더 형태의 뷰를 통해 일자별, 시간별 일정을 직관적으로 관리합니다.
- **🌍 현지 시간 자동 계산**: Google Maps API와 연동하여 여행지의 타임존을 자동으로 파악하고, 한국 시간과 현지 시간을 동시에 확인하며 계획을 세울 수 있습니다.
- **✅ 스마트 체크리스트**: 카테고리별/템플릿별 그룹화 기능을 제공하며, 준비물 진행률을 프로그레스 바를 통해 실시간으로 확인합니다.
- **📋 템플릿 관리**: 자주 사용하는 준비물 리스트를 템플릿으로 저장하고, 새로운 여행에 한 번의 클릭으로 불러올 수 있습니다.
- **👤 마이페이지 & 프로필**: 닉네임 수정, 비밀번호 변경 및 나의 여행 통계 데이터를 확인할 수 있습니다.

## 🛠 기술 스택 (Tech Stack)

### **Frontend**
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Styling**: [Panda CSS](https://panda-css.com/) (Atomic CSS-in-JS)
- **State Management**: [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Handling**: [date-fns](https://date-fns.org/)

### **Backend & Infrastructure**
- **BaaS**: [Supabase](https://supabase.com/) (Auth, Database, RLS)
- **External API**: [Google Maps API](https://developers.google.com/maps) (Places, Time Zone)

### **Native Mobile**
- **Framework**: [Capacitor](https://capacitorjs.com/) (iOS, Android Support)

## 🚀 시작하기 (Getting Started)

### 1️⃣ 저장소 클론 및 패키지 설치
```bash
git clone https://github.com/your-org/nexvoy-frontend.git
cd nexvoy-frontend
pnpm install
```

### 2️⃣ 환경 변수 설정
루트 디렉토리에 `.env.local` 파일을 생성하고 아래 정보를 입력합니다.
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3️⃣ 개발 서버 실행
```bash
pnpm dev
```
이제 [http://localhost:3000](http://localhost:3000)에서 OnVoy를 확인하실 수 있습니다.

## 📱 반응형 디자인
OnVoy는 모바일 우선주의(Mobile-First) 원칙에 따라 설계되었습니다. Web뿐만 아니라 Capacitor를 통해 iOS 및 Android 네이티브 앱 환경도 지원하며 모든 해상도에서 최적화된 UI/UX를 제공합니다.

---
OnVoy와 함께 더 편리하고 즐거운 여행을 계획해 보세요! 🗺️🧳
