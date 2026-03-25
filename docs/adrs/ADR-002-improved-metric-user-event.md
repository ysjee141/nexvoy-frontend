# ADR-002: 사용자의 패턴 분석을 위한 애널리틱스 이벤트 개선

## 상태
- **상태**: 제안됨 (Proposed)
- **날짜**: 2026-03-25

## 문제 정의
현재 서비스에는 기본적인 Firebase Analytics 연동(`@capacitor-community/firebase-analytics`)이 되어 있으나, 사용자가 어떤 기능을 선호하는지, 어디서 이탈하는지를 판단할 수 있는 구체적인 이벤트가 부족합니다. 데이터 기반의 제품 개선을 위해 체계적인 이벤트 트래킹 전략이 필요합니다.

## 의사결정 (Proposed Events)

사용자 행동을 **탐색(Navigation), 핵심 액션(Core Actions), 기술 지표(Technical)** 세 가지 범주로 나누어 관리합니다.

### 1. 탐색 및 메뉴 이용 (Navigation)
| 이벤트명 | 파라미터 | 설명 |
| :--- | :--- | :--- |
| `screen_view` | `screen_name` | 각 페이지 진입 시 (Home, TripDetail, Settings 등) |
| `tab_switch` | `tab_id` | 일정표 vs 체크리스트 탭 전환 |
| `menu_click` | `menu_id` | 가이드, 템플릿, 프로필 등 주요 메뉴 클릭 |

### 2. 핵심 기능 액션 (Core Features)
| 이벤트명 | 파라미터 | 설명 |
| :--- | :--- | :--- |
| `trip_create` | `destination_name` | 새로운 여행 생성 성공 시 |
| `plan_add` | `category`, `has_alarm` | 세부 일정 추가 시 (알람 설정 여부 포함) |
| `checklist_check` | `item_name` | 준비물 체크 완료 시 |
| `trip_share` | `method` | 여행 공유 링크 복사 또는 공유 액션 |
| `template_use` | `template_id` | 추천 템플릿을 본인의 여행에 적용 시 |

### 3. 기술 및 알림 지표 (Technical & Notifications)
| 이벤트명 | 파라미터 | 설명 |
| :--- | :--- | :--- |
| `notification_click` | `notif_type`, `plan_id` | 푸시 또는 로컬 알람을 클릭하여 앱 진입 시 |
| `offline_mode_entry` | - | 네트워크 단절 감지 시 (오프라인 경험 분석) |
| `sync_complete` | `duration_ms` | 서버 데이터 동기화 소요 시간 |

## 구현 시 고려 사항
1. **Deduplication**: 동일한 액션이 중복 수집되지 않도록 컴포넌트 생명주기를 고려합니다.
2. **Privacy**: 개인정보(사용자 이름, 실제 상세 주소 등)는 파라미터에 포함하지 않고 범주화된 정보만 수집합니다.
3. **Consistency**: `userId`를 세션 시작 시 `setUserId`를 통해 바인딩하여 기기 간 경로를 추적합니다.

## 기대 효과
- **기능 우선순위 선정**: 사용률이 낮은 메뉴를 파악하여 UI 개선 또는 기능 제거의 근거로 활용.
- **알람 효율성 측정**: 알람 설정자가 실제 일정을 더 잘 수행하는지, 알림 클릭률은 어떤지 분석.
- **오프라인 사용성 파악**: 여행지의 열악한 네트워크 환경에서 사용자가 앱을 어떻게 사용하는지 확인.
