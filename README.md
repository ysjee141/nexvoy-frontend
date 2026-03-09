# ✈️ Nexvoy (nexvoy-frontend)

**Nexvoy**는 복잡한 여행 계획을 한눈에 정리하고, 현지 시간과 체크리스트를 스마트하게 관리할 수 있도록 돕는 프리미엄 여행 플래너 웹 앱입니다.

![Nexvoy UI Mockup](https://via.placeholder.com/800x400.png?text=Nexvoy+Smart+Travel+Planner) *<!-- 실제 이미지가 있다면 교체 가능 -->*

## ✨ 주요 기능 (Key Features)

- **📅 스마트 일정표 (Weekly Itinerary)**: 주간 캘린더 형태의 뷰를 통해 일자별, 시간별 일정을 직관적으로 관리합니다.
- **🌍 현지 시간 자동 계산**: Google Maps API와 연동하여 여행지의 타임존을 자동으로 파악하고, 한국 시간과 현지 시간을 동시에 확인하며 계획을 세울 수 있습니다.
- **✅ 스마트 체크리스트**: 카테고리별/템플릿별 그룹화 기능을 제공하며, 준비물 진행률을 프로그레스 바를 통해 실시간으로 확인합니다.
- **📋 템플릿 관리**: 자주 사용하는 준비물 리스트를 템플릿으로 저장하고, 새로운 여행에 한 번의 클릭으로 불러올 수 있습니다.
- **🔔 브라우저 알림 (Push Notifications)**: 설정한 일정 시간 전에 브라우저 푸시 알림을 통해 다음 일정을 놓치지 않게 도와줍니다. (Service Worker 기반)
- **👤 마이페이지 & 프로필**: 닉네임 수정, 비밀번호 변경 및 나의 여행 통계 데이터를 확인할 수 있습니다.

## 🛠 기술 스택 (Tech Stack)

### **Frontend**
- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Styling**: [Panda CSS](https://panda-css.com/) (Atomic CSS-in-JS)
- **State Management**: [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Handling**: [date-fns](https://date-fns.org/)

### **Backend & Infrastructure**
- **BaaS**: [Supabase](https://supabase.com/) (Auth, Database, RLS)
- **External API**: [Google Maps API](https://developers.google.com/maps) (Places, Time Zone)

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
이제 [http://localhost:3000](http://localhost:3000)에서 Nexvoy를 확인하실 수 있습니다.

## 📱 반응형 디자인
Nexvoy는 모바일 우선주의(Mobile-First) 원칙에 따라 설계되었습니다. iPhone SE부터 대화면 데스크톱까지 모든 해상도에서 최적화된 UI/UX를 제공합니다.

---
Nexvoy와 함께 더 편리하고 즐거운 여행을 계획해 보세요! 🗺️🧳
