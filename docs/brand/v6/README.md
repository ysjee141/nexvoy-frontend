# 온여정 Brand System v6

온여정의 `ㅇㅇㅈ` 초성에 **계획 → 준비 → 출발** 흐름을 담은 승인 브랜드 시스템이다. 사용자가 선택한 둥근 `ㅈ` 윗획 안에 수평 종이비행기를 배치했으며, 광학 균형을 위해 비행기 전체를 윗획 중심선보다 `5px` 위로 이동했다.

## 핵심 결정

- 첫 `ㅇ`: Pale 외곽과 시계로 계획을 표현한다.
- 둘째 `ㅇ`: 흰색 외곽과 체크로 준비 완료를 표현한다.
- `ㅈ`: 수평 종이비행기로 출발을 표현한다.
- 외곽 획은 `64px`, 내부 행동 단서는 `16px`, 글자 사이 실제 여백은 `36px`다.
- 16px 파비콘은 내부 단서를 제거한 전용 심벌을 사용한다.
- 앱 아이콘은 심벌을 78% 배치 영역에 넣어 시스템 라운딩 뒤에도 좌우 여백을 유지한다.
- Android adaptive foreground와 themed icon은 런처 확대를 보정하는 58% 배치 영역을 사용한다.

## 파일

- `app-icon.svg`: 앱 아이콘 원본
- `brand-mark.svg`: 밝은 배경용 마크
- `brand-mark-reverse.svg`: Primary 배경용 반전 마크
- `brand-mark-mono.svg`: 단색 마크
- `favicon.svg`: 소형 전용 심벌
- `wordmark-lockup.svg`: 한글·영문 워드마크 조합
- `construction.svg`: 기하와 간격
- `brand-system.svg`: 브랜드 시스템 보드
- `png/`: 크기별 배포본

## 재생성

```bash
node docs/brand/v6/render-system.js
```

`render-system.js`가 기하와 색상의 단일 원본이다. 생성 결과는 직접 수정하지 않는다.

## 적용 상태

이 디렉터리는 Git이 추적하는 승인 디자인 원본이다. 앱 아이콘, 스플래시, 웹 로고와 파비콘은 `pnpm brand:apply`로 이 원본에서 생성한다. 제품 적용 시 `docs/brand/BRAND.md`와 `docs/brand/APP-BRAND-ASSET-GUIDE.md`를 따른다.
