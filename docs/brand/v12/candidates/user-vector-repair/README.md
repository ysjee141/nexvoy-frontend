# User Vector Repair Candidate

이 폴더는 사용자가 직접 변환한 `1.svg`, `2.svg`를 원본 PNG와 대조해 보정한 후보본이다. 현재 승인된 v12 canonical 브랜드 에셋의 입력 근거와 비교 기록으로 보관한다.

## 입력 대응

- `input/logo-source.svg` ← `1.svg`
- `input/logo-reference.png` ← `1.png`
- `input/app-icon-source.svg` ← `2.svg`
- `input/app-icon-reference.png` ← `2.png`

## 보정 내용

- 원본에서 추출한 대표 색상으로 wordmark, route, app background, waypoint를 재색상화
- 긴 수평·수직 구간과 꺾임을 원본 비례에 맞춘 둥근 stroke/shape로 재구성해 직선성을 확보
- 하단 `갈`의 세 줄과 연결부를 별도 geometry로 복원해 VTracer 윤곽의 픽셀 굴곡 제거
- 앱 아이콘의 배경, 흰색 심볼, Coral waypoint를 독립적인 vector shape로 재구성
- 원본 PNG, corrected SVG, 50% overlay, 확대 detail 비교 보드 생성

## 실행

```bash
node docs/brand/v12/candidates/user-vector-repair/repair-user-vectors.js
```

승인된 결과를 canonical로 반영할 때는 `docs/brand/v12/apply-approved-assets.js`를 사용한다. 이 후보 폴더의 비교 보드는 QA 기록이며 제품 런타임에 직접 배포하지 않는다.
