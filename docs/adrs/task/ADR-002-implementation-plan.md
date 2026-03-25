# ADR-002 구현 작업 계획서 (Analytics Task Plan)

사용자 패턴 분석을 위한 정량적 데이터 수집 환경을 구축합니다.

## 1단계: 인프라 (Utility)
- `@capacitor-community/firebase-analytics` 기반의 중앙 집중형 `AnalyticsService` 구축
- `userId` 및 `userProperties` 연동

## 2단계: 이벤트 삽입 (Event Tracking)
- **탐색**: 주요 페이지 진입 및 탭 전환 (`screen_view`, `tab_switch`)
- **액션**: 일정 추가, 여행 생성, 체크리스트 확인 (`plan_add`, `trip_create`, `checklist_check`)
- **성공 지표**: 여행 공유 및 템플릿 적용 (`trip_share`, `template_use`)

## 4단계: 이벤트 명세서 (Event Specification)

각 이벤트 발생 시 함께 기록할 파라미터(Payload) 정의입니다.

| 이벤트명 | 파라미터 (Key: Value) | 발생 시점 |
| :--- | :--- | :--- |
| `screen_view` | `screen_name`: string | 페이지 컴포넌트 마운트 시 |
| `tab_switch` | `from_tab`: string, `to_tab`: string | 일정/체크리스트 탭 전환 시 |
| `trip_create` | `destination`: string | 여행 생성 완료 버튼 클릭 시 |
| `plan_add` | `category`: string, `location`: string, `has_alarm`: boolean | 일정 저장 완료 시 |
| `checklist_check`| `item_name`: string, `is_checked`: boolean | 체크박스 상태 변경 시 |
| `trip_share` | `method`: 'copy' \| 'system' | 공유 링크 복사 또는 시스템 공유 시 |
| `template_use` | `template_id`: string | 템플릿 적용 완료 시 |
| `notif_click` | `type`: 'local' \| 'push', `plan_id`: string | 알림 센터에서 알림 클릭 시 |
| `offline_entry` | `timestamp`: number | 네트워크 끊김 감지 시 |

---
*작성일: 2026-03-25 (업데이트됨)*
