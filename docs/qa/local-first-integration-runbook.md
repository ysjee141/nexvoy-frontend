# Local-first 통합 검증 Runbook

## 결론

TASK-035 검증은 자동 Playwright spec과 실기기 smoke를 함께 실행한다. 자동 테스트는 로컬 Supabase에서만 실행하며, Web/Mobile P2P와 backup restore는 디바이스 조건 때문에 runbook 결과를 기록한다.

## 사전 조건

| 항목 | 기준 |
| --- | --- |
| 기준 브랜치 | `refactoring/local-first-architecture`에서 분기한 task 브랜치 |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` host가 `localhost` 또는 `127.0.0.1` |
| 테스트 유저 | `*.onvoy.local` 도메인만 사용 |
| 환경 파일 | `apps/web/.env.test.local` 사용. `.env.local`은 수정하지 않는다 |

## 자동 검증

| 명령 | 확인 범위 |
| --- | --- |
| `pnpm --filter nexvoy-web test:e2e -- local-first-product.spec.ts` | owner/editor/viewer 권한, document-primary checklist reload |
| `pnpm --filter nexvoy-web test:e2e -- observability-safety.spec.ts` | 관측 이벤트 payload 안전성 |
| `pnpm --filter @nexvoy/core test` | core local-first 순수 로직 |
| `pnpm typecheck` | Web/Mobile/Core 타입 정합성 |
| `pnpm build` | Web production build |
| `pnpm build:mobile` | Expo/Metro mobile bundle 정합성 |

## 실기기 Smoke

| 시나리오 | 절차 | 통과 기준 |
| --- | --- | --- |
| Web/Web P2P | owner와 editor 브라우저에서 같은 trip 접속 | 빠른 동기화 상태가 표시되고 한쪽 변경이 반대쪽에 반영 |
| Web/Mobile P2P | Web owner, Mobile editor로 같은 trip 접속 | 일정/준비물/템플릿 변경이 P2P 또는 backup fallback으로 반영 |
| Mobile/Mobile P2P | Android 2대 또는 Android+iOS로 같은 trip 접속 | foreground reconnect 후 변경 전파 |
| Backup restore | 한 기기에서 변경 후 다른 기기 앱 재설치/스토리지 초기화 | encrypted snapshot restore 후 최신 문서 표시 |
| Offline reconnect | 네트워크 차단 상태에서 수정 후 재연결 | 로컬 변경 유지, 재연결 후 원격 반영 |
| Permission boundary | viewer로 동일 trip 접속 | 생성/수정/삭제 CTA 미노출, 문서 읽기 가능 |

## TASK-045 초대 및 Key Delivery

| 시나리오 | 절차 | 통과 기준 |
| --- | --- | --- |
| Web 링크 초대 | Web owner가 이메일 초대 후 별도 Web 계정으로 링크 수락 | membership accepted, 준비 중 표시, owner 화면 조작 없이 key completed, 동일 snapshot 표시 |
| Web 코드 초대 | invitee가 `/join`에서 코드 입력 후 수락 | 링크 수락과 동일한 document/member/key 결과 |
| Owner offline | owner를 종료하고 invitee가 수락한 뒤 owner가 다시 상세 진입 | owner 재접속 후 10초 이내 key completed, invitee 자동 restore |
| 홈 pending 수락 | invitee 홈 배너에서 수락 | `/join?acceptedDocumentId=...` 준비 화면으로 이동하고 restore 후 상세 진입 |
| Web/Mobile | Web owner가 Mobile 계정을 초대 | Mobile native key row 생성, encrypted snapshot restore, 동일 일정·준비물 표시 |
| Viewer boundary | viewer 역할로 수락 후 변경 시도 | restore/read 성공, 일정·준비물 mutation과 backup upload 차단 |

확인할 Supabase registry:

- `document_members.status = 'accepted'`
- `document_key_provisioning_requests.status = 'completed'`
- invitee device의 active `document_keys` row 존재
- plaintext key와 document payload가 log/notification에 없음

## 결과 기록

각 실행은 PR 또는 task walkthrough에 아래 형식으로 남긴다.

| 날짜 | 환경 | 명령/시나리오 | 결과 | 비고 |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | Chrome + Local Supabase | `local-first-product.spec.ts` | PASS/FAIL | 실패 시 trace 경로 |
| YYYY-MM-DD | Android preview APK | Web/Mobile P2P | PASS/FAIL | 기기/OS 버전 |
