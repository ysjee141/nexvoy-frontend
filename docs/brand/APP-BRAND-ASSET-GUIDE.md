# 온여정 앱 브랜드 자산 가이드

## 브랜드 콘셉트

「온기 있는 여정선」은 동행자와 함께 이어 가는 여행을 하나의 선으로 표현한다. 선이 만드는 열린 `O/ㅇ` 형태는 OnVoy와 온여정을 함께 암시하고, coral 원은 아직 닿지 않은 목적지와 출발 전 설렘을 뜻한다.

## 색상

| 역할 | 색상 | 용도 |
|---|---|---|
| Cobalt | `#2563EB` | 아이콘 배경, 브랜드 인지색 |
| Warm white | `#FFFDF8` | 여정선, 스플래시 배경 |
| Coral | `#FF8A65` | 목적지 점에만 제한적으로 사용 |
| Ink | `#1E293B` | 스토어 문구 |

Coral은 제품 UI의 신규 상태색이 아니다. 브랜드 이미지의 목적지 점에만 사용하며 기존 Clear Departure의 10% 강조색 원칙을 유지한다.

## 사용 규칙

- 앱 아이콘 원본에는 둥근 모서리, 그림자, gradient를 넣지 않는다. OS와 스토어가 최종 mask를 적용한다.
- 심볼의 형태와 여백 비율을 임의로 변경하거나 외곽선을 추가하지 않는다.
- 단색 배경에서는 기본 Cobalt 아이콘을 사용한다. Cobalt 표면에서는 warm-white 여정선과 coral 목적지만 사용한다.
- Android adaptive icon의 foreground는 `adaptive-foreground.png`, 배경은 `#2563EB`로 고정한다.
- Adaptive foreground는 Android 런처가 추가 확대하므로 원본 심볼의 75% 비율을 유지한다.
- Android 알림은 `notification-icon.png`의 단색 alpha 실루엣만 사용한다.
- 네이티브 splash 배경은 `#FFFDF8`이며 슬로건이나 로딩 문구를 추가하지 않는다.

## 원본과 파생 자산

편집 가능한 원본은 `apps/mobile/assets/branding/source`에 있다. 배포용 PNG는 같은 상위 디렉터리에 두며, Play Store 제출 자산은 `apps/mobile/assets/branding/store`에 둔다.

| 파일 | 규격 | 용도 |
|---|---:|---|
| `icon.png` | 1024×1024 | Expo/iOS 공통 앱 아이콘 |
| `adaptive-icon.png` | 1024×1024 | Android adaptive foreground |
| `adaptive-icon-monochrome.png` | 1024×1024 | Android themed icon |
| `notification-icon.png` | 96×96 | Android notification |
| `splash-icon.png` | 512×512 | 네이티브 splash 심볼 |
| `store/play-store-icon.png` | 512×512 | Play Store 아이콘 |
| `store/play-store-feature-graphic.png` | 1024×500 | Play Store feature graphic |

## 금지 예시

- 비행기, 지도 핀, 여권, 나침반을 추가해 일반 여행 앱 아이콘으로 변형
- coral 원을 여러 곳에 장식적으로 반복
- 사진이나 질감 위에 심볼을 배치해 작은 크기의 대비를 저하
- `Nexvoy` 명칭 또는 이전 기하 로고와 혼용
