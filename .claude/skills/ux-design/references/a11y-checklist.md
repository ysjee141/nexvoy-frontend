# 접근성·반응형 체크리스트

## 터치 타깃

- [ ] 모든 인터랙티브 요소 ≥ 44x44px (iOS HIG / Material Design)
- [ ] 인접 타깃 사이 최소 8px 간격
- [ ] 아이콘 버튼은 시각적 크기가 작아도 hit area를 44px로 확장

## 키보드·포커스 (웹)

- [ ] Tab 순서가 시각적 순서와 일치
- [ ] 포커스 인디케이터가 명확 (outline 또는 box-shadow)
- [ ] 모달 열림 시 포커스가 모달 내부로 이동, 닫힘 시 트리거로 복귀
- [ ] Escape 키로 모달 닫기

## ARIA·시멘틱

- [ ] 헤딩 레벨(h1~h6) 위계 유지
- [ ] `button` vs `a` 의미 구분 (행동 vs 이동)
- [ ] 폼 입력에 `<label>` 또는 `aria-label`
- [ ] 라이브 영역(`aria-live`)으로 동적 변경 안내

## 콘트라스트

WCAG AA 기준:
- [ ] 일반 텍스트 4.5:1 이상
- [ ] 큰 텍스트(18pt+) 3:1 이상
- [ ] `brand.muted` (#64748B) on white = 4.7:1 ✓
- [ ] `brand.ink` (#1E293B) on white = 13.7:1 ✓

## Safe Area (모바일/Capacitor)

- [ ] 상단 헤더: `env(safe-area-inset-top)` 또는 `paddingTop`로 notch 처리
- [ ] 하단 탭바·FAB: `env(safe-area-inset-bottom)`으로 home indicator 처리
- [ ] 모달 close 버튼: 상단 Safe Area 내부에 위치
- [ ] 풀스크린 콘텐츠는 Safe Area 무시 가능 (e.g. 이미지)

## 반응형 브레이크포인트

| 영역 | 모바일 우선 |
|------|------------|
| < 768px | 모바일 (Capacitor 포함) |
| 768~1024px | 태블릿 (선택적) |
| > 1024px | 데스크탑 |

- [ ] 모바일에서 디자인 시작, 데스크탑은 확장
- [ ] 컨테이너 max-width 설정 (너무 넓어지지 않도록)
- [ ] 터치 vs 마우스 인터랙션 차이 (hover 의존 금지)

## 모션·애니메이션

- [ ] `prefers-reduced-motion` 존중 (사용자가 모션 감소 선호 시 줄이기)
- [ ] 자동 재생 동영상·캐러셀 없음 또는 pause 가능
- [ ] 깜빡임 3Hz 미만 (광과민성 발작 예방)

## 색맹·색약

- [ ] 색상만으로 정보 전달 금지 (아이콘/텍스트 병행)
- [ ] 에러는 빨강만으로 표시하지 않고 ⚠ 아이콘 + 텍스트 함께
