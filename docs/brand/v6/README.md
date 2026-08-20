# Legacy: 온여정 / OnVoy Brand System v6

> 상태: 폐기됨, 역사 보관 전용
>
> 현재 브랜드: `갈래 / Nextward`
>
> 현재 기준: `docs/brand/BRAND.md`

이 디렉터리는 이전 `온여정 / OnVoy` 브랜드의 `ㅇㅇㅈ` 심벌, 컬러, 생성 스크립트와 PNG 파생본을 보존한다. 리브랜딩 이력과 기존 배포 자산의 출처를 추적하기 위한 자료이며 현재 승인 브랜드 원본이 아니다.

## 사용 금지

- 새 `갈래 / Nextward` 로고나 앱 아이콘의 기초 도형으로 사용하지 않는다.
- 기존 SVG의 색상만 바꿔 새 브랜드 자산으로 만들지 않는다.
- 이 디렉터리의 PNG, SVG, ICO를 신규 화면, 스토어 또는 마케팅에 배포하지 않는다.
- `render-system.js` 또는 루트 `pnpm brand:apply`를 일반 브랜드 작업에 실행하지 않는다.
- `ㅇㅇㅈ` 심벌과 새 공통 경로 심벌을 혼용하지 않는다.

## 보존 파일

```text
app-icon.svg
brand-mark.svg
brand-mark-reverse.svg
brand-mark-mono.svg
favicon.svg
wordmark-lockup.svg
construction.svg
brand-system.svg
brand-system.png
png/
render-system.js
```

파일명과 내부의 `온여정`, `OnVoy`, 기존 색상 값은 당시 산출물의 재현성을 위해 그대로 유지한다. 이 값은 현재 브랜드 기준이 아니며 `docs/brand/BRAND.md`의 이름과 컬러를 우선한다.

## 레거시 재현

과거 산출물 조사나 회귀 비교를 위해 꼭 필요한 경우에만 다음 명령을 직접 실행할 수 있다.

```bash
node docs/brand/v6/render-system.js
```

이 명령은 `v6` 내부 산출물을 다시 만들 수 있다. 제품 배포 자산까지 복사하는 `pnpm brand:apply`는 새 브랜드 생성 파이프라인이 완성될 때까지 실행하지 않는다.

## 후속 정리

새 브랜드 원본과 생성 파이프라인이 등록된 뒤 다음을 결정한다.

- `v6`를 장기 보존할지 별도 legacy 경로로 이동할지
- 레거시 정적 URL 호환이 필요한지
- `render-system.js`와 기존 PNG 파생본을 계속 보관할지
- 루트 `brand:apply` 명령을 교체한 뒤 레거시 실행 경로를 제거할지
