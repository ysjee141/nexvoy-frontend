# TASK-065: 온여정 앱 아이콘·스플래시 브랜드 자산

- 상태: 런처 여백 보완 완료, 수정 APK 실기기 재확인 필요
- GitHub Issue: [#387](https://github.com/ysjee141/nexvoy-frontend/issues/387)
- 영향 범위: Mobile 런처/스플래시/알림, Play Store 제출 자산

## 목적

기존 시각 자산을 온여정(OnVoy) v6 브랜드 시스템으로 교체한다. 모바일 런처부터 브라우저 파비콘까지 동일한 `ㅇㅇㅈ` 심벌을 사용하고 작은 크기에서도 분명히 식별되어야 한다.

## 디자인 결정

한글 초성 `ㅇㅇㅈ`에 **계획 → 준비 → 출발** 흐름을 결합한 v6를 채택한다. 첫 `ㅇ`의 시계는 계획, 둘째 `ㅇ`의 체크는 준비 완료, `ㅈ` 윗획의 수평 종이비행기는 출발을 뜻한다. Primary `#2563EB`과 제품 디자인 토큰만 사용한다.

## 범위

- 재현 가능한 SVG 심볼 원본
- iOS/공통 1024px 앱 아이콘
- Android adaptive foreground와 monochrome icon
- Android notification icon
- 네이티브 splash icon과 warm-white 배경
- Play Store 512px icon과 1024×500 feature graphic
- Expo 설정과 브랜드 사용 가이드
- Web ICO·SVG favicon, Apple Touch icon과 192/512px 설치 아이콘
- 플랫폼 배포 자산 재생성 스크립트

## 제외 범위

- 앱 화면 컴포넌트 리디자인
- 앱 ID/slug 변경
- App Store/Play Store 콘솔 업로드

## 구현 단계

1. `docs/brand/v6`에 기하와 색상이 고정된 SVG 원본을 보존한다.
2. `pnpm brand:apply`로 플랫폼별 안전 영역과 투명도 규칙에 맞는 자산을 파생한다.
3. Expo icon, splash, adaptive, themed, notification 경로와 Web metadata를 연결한다.
4. 소형 가독성, 파일 규격, Expo export와 Web production build를 검증한다.
5. Android 실기기에서 확인된 런처 마스크 과밀을 반영해 공통 icon과 adaptive foreground 안전 여백을 분리한다.

## 검증 방법

- PNG 크기·포맷·alpha 검사
- 32px 축소본과 adaptive mask 미리보기 확인
- `pnpm --filter nexvoy-app typecheck`
- `pnpm --filter nexvoy-app lint`
- `pnpm --filter nexvoy-app build`
- `pnpm --filter nexvoy-web build`
- Android preview APK 설치·실행 및 런처/스플래시 확인
- 브라우저 탭·Apple Touch·설치형 웹 앱 아이콘 확인

## 롤백 방법

이전 커밋의 `apps/mobile/assets/branding`, `apps/web/app` metadata 자산과 `apps/web/public/logo.png`를 복원한다. DB나 사용자 데이터 정리는 필요하지 않다.

## 완료 조건

- [x] 런처와 시작 화면이 온여정 심볼로 표시된다.
- [x] Android adaptive/monochrome/notification 규격을 충족한다.
- [x] 스토어 제출용 필수 이미지 규격을 충족한다.
- [x] 웹 파비콘과 설치 아이콘이 v6 심벌을 사용한다.
- [x] 모바일 export와 Android native debug build를 통과한다.
- [ ] 여백 보완 v6 APK를 Android 실기기에 설치해 launcher mask와 splash를 최종 확인한다.
