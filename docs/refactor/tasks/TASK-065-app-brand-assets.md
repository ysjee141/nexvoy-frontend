# TASK-065: 온여정 앱 아이콘·스플래시 브랜드 자산

- 상태: 구현 완료
- GitHub Issue: [#387](https://github.com/ysjee141/nexvoy-frontend/issues/387)
- 영향 범위: Mobile 런처/스플래시/알림, Play Store 제출 자산

## 목적

기존 Nexvoy 시각 자산을 온여정(OnVoy)의 이름과 제품 감성에 맞는 일관된 브랜드 자산으로 교체한다. 여행의 따뜻함과 출발 전 설렘을 전달하면서 작은 런처 아이콘에서도 분명히 식별되어야 한다.

## 디자인 결정

「온기 있는 여정선」을 채택한다. Cobalt 바탕 위의 warm-white 선이 `O/ㅇ`을 연상시키는 여정을 만들고, coral 원은 앞으로 향하는 목적지와 기대감을 나타낸다. 사진, 비행기, 지도 핀 같은 직접적인 여행 클립아트는 사용하지 않는다.

## 범위

- 재현 가능한 SVG 심볼 원본
- iOS/공통 1024px 앱 아이콘
- Android adaptive foreground와 monochrome icon
- Android notification icon
- 네이티브 splash icon과 warm-white 배경
- Play Store 512px icon과 1024×500 feature graphic
- Expo 설정과 브랜드 사용 가이드

## 제외 범위

- 앱 화면 컴포넌트 리디자인
- 앱 ID/slug 변경
- 웹 로고·파비콘 교체
- App Store/Play Store 콘솔 업로드

## 구현 단계

1. 생성형 콘셉트를 바탕으로 기하와 색상이 고정된 SVG 원본을 제작한다.
2. 플랫폼별 안전 영역과 투명도 규칙에 맞춰 PNG를 파생한다.
3. Expo icon, splash, adaptive icon, notification 플러그인을 연결한다.
4. 소형 가독성, 파일 규격, Expo export와 Android 런타임을 검증한다.

## 검증 방법

- PNG 크기·포맷·alpha 검사
- 32px 축소본과 adaptive mask 미리보기 확인
- `pnpm --filter nexvoy-app typecheck`
- `pnpm --filter nexvoy-app lint`
- `pnpm --filter nexvoy-app build`
- Android preview APK 설치·실행 및 런처/스플래시 확인

## 롤백 방법

`app.json`의 icon/splash/notification 경로를 제거하고 신규 `assets/branding` 디렉터리를 삭제한다. DB나 사용자 데이터 정리는 필요하지 않다.

## 완료 조건

- [x] 런처와 시작 화면이 온여정 심볼로 표시된다.
- [x] Android adaptive/monochrome/notification 규격을 충족한다.
- [x] 스토어 제출용 필수 이미지 규격을 충족한다.
- [x] 모바일 export와 Android 시각 검증을 통과한다.
