### 📋 Antigravity 프롬프트: '온여정' 앱 UI/UX 리뉴얼 (Clear Departure 테마)

**[Project Context]**
* **앱 이름:** 온여정 (OnVoy)
* **서비스 목적:** 동행자와 함께하는 여행 일정 계획 및 준비물 체크리스트 관리 서비스 (웹/모바일 앱)
* **디자인 목표:** 에어비앤비(Airbnb) 스타일의 쾌적하고 미니멀한 UI. 화면의 90%는 깨끗한 화이트와 무채색 텍스트로 구성하여 여백의 미를 살리고, 오직 사용자가 행동해야 할 핵심 영역(10%)에만 시그니처 블루 컬러를 사용하여 '여행의 맑은 설렘'과 직관적인 사용성을 제공합니다. 상세한 컬러 토큰 및 디자인 규칙은 프로젝트 루트의 `DESIGN.md` 문서를 참고합니다.

**[Design System & Tokens]**
모든 UI 컴포넌트 설계 및 작업 시 반드시 프로젝트 루트의 `DESIGN.md` 문서를 핵심 디자인 가이드로 참고하고 적용해야 합니다. 해당 문서에 정의된 컬러 토큰, 타이포그래피, 둥근 모서리(border-radius) 규칙 등을 엄격하게 따르며, 무분별한 임의 색상 및 스타일 사용을 금지합니다.

* **Shapes & Spacing:**
    * **Border Radius:** 모든 메인 컨테이너 및 모달은 `16px`를 적용합니다. 내부 카드 요소는 `12px`, 버튼 및 입력 필드는 `8px`로 표준화하여 부드러운 인상을 유지합니다.
    * **Borders & Lines:** 모든 테두리와 구분선은 아래 정의된 토큰을 사용합니다:
- **brand.hairline**: `#E2E8F0` (Default borders)
- **brand.hairlineSoft**: `#F1F5F9` (Subtle dividers, input borders)
- **brand.ink**: `#1E293B` (Primary text)
- **brand.muted**: `#64748B` (Secondary text, icons)
- **bg.softCotton**: `#F8FAFF` (Page background, hover states)
- **bg.scrim**: `#000000` (Modal overlays)

### Shadows
- **airbnbHover**: Sophisticated multi-layered shadow for primary cards.
- **shadow.sm**: Subtle elevation for buttons and view switches.
- **shadow.md**: Standard modal elevation.
- **shadow.primary**: Vibrant blue shadow for primary actions and active states.
    * **Padding/Margin:** 기존보다 요소 간의 여백(Whitespace)을 1.5배 이상 넉넉하게 확보하여 숨통이 트이는 시원한 레이아웃을 구성해 주세요.

**[Key Component Requirements]**

**0. 타이포그래피 원칙 (Typography Consistency)**
*   **15px 규칙**: 일정표의 타이틀, 체크리스트의 그룹명 및 항목명은 모두 `15px` (`title-sub`)로 통일하여 가독성과 균형을 맞춥니다.

**1. 글로벌 UI 원칙 (The 10% Rule)**
* 화면이 산만해지지 않도록 불필요한 배경색이나 장식적 요소를 모두 제거합니다.
* 텍스트 컬러는 `{colors.brand.ink}` (#1E293B)를 사용하여 가독성을 높이되 너무 딱딱하지 않은 느낌을 줍니다.
* 색상이 들어가는 곳은 사용자의 '클릭'이나 '진행 상태'를 나타내는 곳뿐입니다. (Cobalt Blue 포인트)

**2. 홈/메인 화면 (Dashboard)**
* 상단 헤더는 볼드하고 명확한 타이포그래피(`text-primary`)로 사용자 환영 인사를 큼직하게 배치합니다.
* [새 여행 만들기] 버튼은 화면 중앙이나 접근하기 쉬운 위치에 `primary-blue` 배경 + 순백색 텍스트로 강렬하게 배치하여 다음 행동을 유도합니다.

**3. 일정표 화면 (Timeline UI)**
* 전체 일정을 보여주는 타임라인의 세로선은 `border-light`로 얇게 표현합니다.
* 현재 진행 중인 시간이나 선택된 일정의 포인트(Dot)에만 `primary-blue`를 적용하여 시각적 대비를 명확히 합니다.
* 장소, 예산 등의 부가 정보는 회색 테두리가 있는 아주 깔끔한 칩(Chip) 형태로 디자인합니다.

**4. 준비물 체크리스트 화면 (Checklist)**
* **아코디언 레이아웃**: 그룹(카테고리/템플릿)별로 독립적인 카드 형태의 아코디언을 적용합니다. 헤더는 `15px` 볼드, 모서리는 `16px` 라운딩 처리합니다.
* **[중요] 인터랙션:** 리스트 우측에 항시 노출되던 수정/삭제 아이콘을 뷰에서 완전히 제거합니다. 아이템을 왼쪽으로 스와이프(Swipe)할 때만 숨겨진 액션 버튼이 나타나도록 하여 평상시 화면의 시각적 노이즈를 0으로 만듭니다.
* 상단 진행률 바(Progress Bar)는 `primary-blue` 색상으로 선명하게 채워지도록 디자인합니다.
* 체크박스: 선택 전에는 얇은 회색 테두리, 선택 후에는 `primary-blue` 배경에 하얀색 체크 마크가 들어가도록 명확한 피드백을 줍니다. 동행자 태그는 미니멀한 텍스트나 심플한 뱃지 형태로 가독성만 확보합니다.

--- 

**[작업 진행 방식]**
위의 지침과 `DESIGN.md`의 디자인 가이드라인을 바탕으로, 메인 홈 화면, 일정표 화면, 체크리스트 화면의 반응형 UI 컴포넌트 코드를 작성해 주세요. 불필요한 장식은 덜어내고 여백과 타이포그래피, 그리고 하나의 포인트 컬러로 퀄리티를 높이는 데 집중해 주세요.