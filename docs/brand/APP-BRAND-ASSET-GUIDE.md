# 온여정 앱 브랜드 자산 적용 가이드

앱 브랜드 자산은 `docs/brand/v6`의 승인 원본에서 생성한다. `apps/mobile/assets/branding`의 배포 파일을 직접 디자인 원본으로 취급하지 않는다.

## 적용 원본

| 대상 | 승인 원본 | 적용 위치 |
| --- | --- | --- |
| 공통 앱 아이콘 | `v6/app-icon.svg` | `apps/mobile/assets/branding/icon.png` |
| Android adaptive icon | v6 반전 마크 58% 배치 영역 | `apps/mobile/assets/branding/adaptive-icon.png` |
| Android themed icon | v6 소형 단색 실루엣 58% 배치 영역 | `apps/mobile/assets/branding/adaptive-icon-monochrome.png` |
| Android 알림 | v6 소형 단색 실루엣 | `apps/mobile/assets/branding/notification-icon.png` |
| 네이티브 스플래시 | `v6/brand-mark.svg` | `apps/mobile/assets/branding/splash-icon.png` |
| Play Store | `v6/app-icon.svg` | `apps/mobile/assets/branding/store/play-store-icon.png` |
| 브라우저 파비콘 | `v6/favicon.svg` | `apps/web/app/favicon.ico`, `apps/web/app/icon.svg` |
| Apple Touch icon | `v6/app-icon.svg` | `apps/web/app/apple-icon.png` |
| 설치형 웹 앱 | `v6/app-icon.svg` | `apps/web/public/icons/` |
| Web 화면 로고 | `v6/favicon.svg` | `apps/web/public/brand/onvoy-app-icon-v6.png` |

정확한 파일명은 앱 설정과 함께 확인한다. 플랫폼 자산을 교체할 때 `apps/mobile/app.json`의 경로와 배경색도 함께 검증한다.

## 플랫폼 규칙

- 앱 아이콘 원본에는 둥근 모서리와 그림자를 추가하지 않는다. OS와 스토어가 최종 마스크를 적용한다.
- 공통 앱 아이콘은 전체 캔버스의 78% 배치 영역을 사용해 실제 심벌 폭을 약 68%로 제한한다.
- Android adaptive icon은 런처의 전경 확대를 감안해 전체 캔버스의 58% 배치 영역을 사용한다.
- Android themed icon과 알림 아이콘은 단색 alpha 실루엣을 사용한다.
- 알림 아이콘은 작은 상태바 식별성을 위해 adaptive icon보다 큰 75% 배치 영역을 유지한다.
- 스플래시는 앱 아이콘 사각형 대신 투명 배경의 기본 마크를 사용한다.
- 스플래시 배경색은 `#FFFFFF` 또는 제품에서 승인한 밝은 표면색을 사용한다.
- `#2563EB` 배경에서는 `brand-mark-reverse.svg`를 사용한다.

## 검증 절차

1. `pnpm brand:apply`로 승인 원본과 플랫폼 자산을 재생성한다.
2. 생성된 PNG, SVG와 ICO의 크기·alpha를 확인한다.
3. `pnpm --filter nexvoy-app typecheck`와 Expo 설정 검사를 실행한다.
4. Android adaptive, themed, notification, splash 화면을 실제 기기에서 확인한다.
5. Play Store와 브라우저 탭, 홈 화면 설치 미리보기에서 잘림, 여백, 색상 변화를 확인한다.

이전 「온기 있는 여정선」 아이콘은 폐기된 시안이다. v6 `ㅇㅇㅈ` 심벌과 혼용하지 않는다.
