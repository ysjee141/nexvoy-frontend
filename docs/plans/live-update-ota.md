# Live Update (OTA) 구현 계획서

본 문서는 앱 바이너리 재배포 없이 웹 콘텐츠를 실시간으로 업데이트하는 **Live Update (OTA)** 시스템 구축 계획을 기술합니다. **Capgo** 솔루션을 사용하여 안정적이고 투명한 업데이트 프로세스를 구축하는 것을 목표로 합니다.

## 1. 개요 (Overview)
- **목적**: 오타 수정, 버그 해결, UI 개선 등을 스토어 심사 없이 즉각 반영.
- **주요 기술**: `@capgo/capacitor-updater` (Capacitor용 OTA 플러그인).
- **작동 방식**: 앱 시작 시 서버에서 최신 번들을 체크하고, 존재할 경우 진행 상태를 화면에 표시하며 다운로드 후 앱을 갱신합니다.

---

## 2. 사전 요구 사항 (Prerequisites)
- [ ] **Capgo 계정**: [capgo.app](https://capgo.app/) 가입 및 API Key 발급.
- [ ] **Capgo CLI**: `npm install -g @capgo/cli` 로컬 설치.
- [ ] **앱 등록**: 대시보드에 `xyz.nexvoy.app` 등록 및 `Production`, `Staging` 채널 생성.

---

## 3. 구현 단계 (Implementation Steps)

### 3.1. 의존성 및 설정
- **플러그인 설치**:
  ```bash
  pnpm add @capgo/capacitor-updater
  npx cap sync
  ```
- **[capacitor.config.ts](file:///Users/ysjee141/mySources/travel-pack/capacitor.config.ts)**:
  - `Updater` 플러그인 설정 추가.
  - 빌드 시점의 환경 변수에 따라 `channel`이 결정되도록 구성.

### 3.2. 업데이트 UI & 로직 개발
- **`UpdateSplashScreen` 컴포넌트**: 
  - 앱 로딩 시 업데이트 유무를 확인하는 동안 표시될 전체 화면 오버레이.
  - 진행률(%) 표시 바(Progress Bar) 포함.
- **`useLiveUpdate` 커스텀 훅**:
  - `@capgo/capacitor-updater`의 `addListener('downloadProgress', ...)`를 활하여 상세 진행률 수집.
  - 업데이트 완료 시 `CapacitorUpdater.reload()`를 호출하여 최신 코드로 즉시 전환.

### 3.3. 앱 구조 통합
- **[layout.tsx](file:///Users/ysjee141/mySources/travel-pack/src/app/layout.tsx)**:
  - 최상위 레이아웃에서 `UpdateSplashScreen`을 조건부 렌더링.
  - 업데이트 중에는 메인 콘텐츠 렌더링을 차단하여 일관성 유지.

---

## 4. 배포 및 운영 전략 (Deployment Strategy)

### 4.1. 환경 분리 (Environment Separation)
- **Staging**: 내부 테스트 기기에서 먼저 업데이트를 확인하는 용도.
- **Production**: 실제 사용자에게 배포되는 최종 버전.

### 4.2. 배포 자동화 흐름
1. **빌드**: `pnpm build:mobile` (Next.js static export 생성).
2. **압축 및 전송**: 
   - `npx capgo upload -a <KEY> -i xyz.nexvoy.app -v 1.0.1 -c staging`
3. **검증**: Staging 기기에서 정상 작동 확인.
4. **승급 (Promote)**: 대시보드에서 `staging`에서 `production`으로 번들 전환.

---

## 5. 예외 처리 가이드 (Error Handling)
- **네트워크 오류**: 다운로드 실패 시 사용자에게 알리고 기존 버전으로 앱 실행 유지.
- **용량 부족**: 기기 용량이 부족할 경우 업데이트 건너뛰기.
- **안정성 롤백**: 업데이트 후 앱에 오류 발생 시 `resetWhenError: true` 옵션을 통해 이전 버전으로 자동 복구.

---

## 6. 향후 확장성
- **강제 업데이트 알림**: 특정 버전 미만 사용자에 대해 스토어 업데이트 유도 알림 연동.
- **A/B 테스팅**: 특정 사용자 그룹에게만 새로운 OTA 번들 배포 가능.

---

> [!WARNING]
> **Native 변경 주의**: 새로운 Capacitor 플러그인을 설치하거나 `android/`, `ios/` 폴더 내의 코드를 수정하여 커밋한 경우에는 Live Update를 사용할 수 없으며, 반드시 앱 스토어 심사를 거쳐야 합니다.
