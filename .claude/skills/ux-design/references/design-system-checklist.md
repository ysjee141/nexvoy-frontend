# Clear Departure 디자인 시스템 체크리스트

`docs/develop-context/design-guide.md`와 대조하여 점검한다.

## 컬러 토큰

| 토큰 | Hex | 용도 |
|------|-----|------|
| `brand.ink` | #1E293B | Primary text |
| `brand.muted` | #64748B | Secondary text, icons |
| `brand.hairline` | #E2E8F0 | Default borders |
| `brand.hairlineSoft` | #F1F5F9 | Subtle dividers |
| `bg.softCotton` | #F8FAFF | Page background, hover |
| `bg.scrim` | #000000 | Modal overlay |
| `primary-blue` (Cobalt Blue) | -- | 10% Rule 포인트 |

**점검 사항:**
- [ ] 임의 hex 사용 없음 (예: `#2EC4B6` 같은 과거 민트색 발견 시 즉시 교체)
- [ ] 텍스트 컬러는 `brand.ink` 우선, 보조 정보만 `brand.muted`
- [ ] 배경은 화이트 + `bg.softCotton`만 (장식적 배경색 금지)

## Border Radius

| 영역 | 값 |
|------|----|
| 메인 컨테이너·모달 | 16px |
| 카드 요소 | 12px |
| 버튼·입력 필드 | 8px |

**점검 사항:**
- [ ] 일관된 radius 적용
- [ ] 새 컴포넌트가 위 3단계 중 어디에 속하는지 명시

## 타이포그래피

- **15px 규칙**: 일정표 타이틀, 체크리스트 그룹명·항목명 → 15px (`title-sub`)
- 가독성·균형 목적

**점검 사항:**
- [ ] 15px 통일 영역에서 다른 크기 사용 여부
- [ ] 타이포그래피 토큰 사용 (임의 px 금지)

## Shadow

| 토큰 | 용도 |
|------|------|
| `shadow.sm` | 버튼, 뷰 스위치 |
| `shadow.md` | 모달 표준 |
| `shadow.primary` | Primary action active |
| `airbnbHover` | Primary 카드 multi-layered |

## 여백 (Whitespace)

- 기존 대비 1.5배 이상 확보
- 숨통이 트이는 시원한 레이아웃

## 10% Rule

화면의 90%는 화이트 + 무채색 텍스트.
색상은 다음 영역에만:
- 사용자가 클릭해야 할 곳 (Primary CTA)
- 진행 상태 (현재 시간, 선택 일정, 진행률 바)
- 활성 상태 (선택된 탭, 토글 ON)

**점검 사항:**
- [ ] 장식적 배경색 없음
- [ ] Cobalt Blue가 위 3가지 용도 외 사용 없음
- [ ] 불필요한 아이콘·테두리·구분선 제거

## 인터랙션 노이즈 최소화

- 평상시 화면에 수정/삭제 아이콘 노출 금지
- 스와이프(좌) 시에만 액션 노출
- 시각적 노이즈 0이 목표
