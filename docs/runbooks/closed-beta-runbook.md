# Closed Beta Runbook

## 결론

Closed Beta는 제한된 테스터에게 Local-first document-primary 제품을 노출하고, 동기화/복구/권한/알림 안정성을 매일 확인하는 운영 단계다. 기능 미완성 검증이 아니라 출시 전 운영 리허설로 취급한다.

## Roles

| 역할 | 책임 |
| --- | --- |
| Release owner | go/no-go 판단, deploy 승인, rollback 승인 |
| QA owner | daily smoke, device matrix, regression 기록 |
| Support owner | tester 초대, 피드백 triage, 삭제 요청 응답 |
| Incident owner | SEV 판단, timeline 기록, 후속 task 생성 |

## Tester Onboarding

| 단계 | 조치 |
| --- | --- |
| 1 | 테스터 이메일/기기/OS/플랫폼(Web/Android/iOS)을 기록 |
| 2 | 개인정보/피드백 수집 범위와 beta 제한 사항 안내 |
| 3 | Web URL 또는 Play Internal Testing/TestFlight 초대 발송 |
| 4 | 첫 로그인, trip 생성, invite accept, backup restore smoke 요청 |
| 5 | 피드백 채널과 incident contact 공유 |

## Daily Smoke

| 시나리오 | 기준 |
| --- | --- |
| Auth | email/social login, logout, account switch |
| Trip | create, open, edit destination/date, delete/withdraw if available |
| Plans | add/edit/delete/toggle visited, location/photo fallback |
| Checklist | add/edit/delete/check, assignment/template apply |
| Collaboration | owner invites editor/viewer, accept, permission boundary |
| Local-first | offline edit, reconnect, reload, cross-device restore |
| P2P | Web/Web and Web/Mobile fast path or backup fallback |
| Notifications | local reminder/push metadata path smoke |
| Feedback | `/api/feedback` Discord delivery |

TASK-035의 상세 cross-device 절차는 `docs/qa/local-first-integration-runbook.md`를 따른다.

## Feedback Triage

| 등급 | 기준 | 처리 |
| --- | --- | --- |
| Critical | 데이터 손실, 권한 우회, 앱 실행 불가 | incident 생성, rollout 중단 판단 |
| Major | 주요 여정/준비물/초대/동기화 실패 | 24시간 내 fix/rollback 판단 |
| Minor | UI 불편, 문구, 비핵심 알림 | backlog |
| Question | 사용법/기대 동작 문의 | FAQ 또는 onboarding 보강 |

## Data & Privacy Requests

| 요청 | 처리 기준 |
| --- | --- |
| 계정 삭제 | 본인 확인 후 Supabase Auth/profile/trip ownership/local backup 영향 확인 |
| trip 삭제 | owner 요청인지 확인하고 shared member 영향 안내 |
| feedback 삭제 | Discord 첨부/메시지 삭제 가능 여부 확인 |
| 데이터 export | Closed Beta에서는 수동 지원 여부를 release owner가 결정 |

## Communication Template

| 상황 | 메시지 요지 |
| --- | --- |
| 초대 | beta 목적, 설치 링크, 피드백 채널, 알려진 제한 |
| 장애 | 영향 범위, 임시 우회, 다음 업데이트 예상 시간 |
| 복구 | 원인 요약, 사용자 조치 필요 여부, 재발 방지 |
| 종료 | beta 기간 종료, 데이터 보존/삭제 정책, 다음 단계 |

## Exit Criteria

Closed Beta를 종료하고 다음 단계로 넘어가려면 다음을 만족한다.

1. 7일 이상 SEV1 없음.
2. 핵심 smoke 시나리오 3회 연속 PASS.
3. 신규 Major issue가 triage SLA 안에서 처리됨.
4. store privacy/legal blocker 없음.
5. rollback runbook이 실제 incident drill 또는 tabletop review를 통과함.
