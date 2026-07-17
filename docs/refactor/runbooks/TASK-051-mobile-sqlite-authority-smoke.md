# TASK-051 Mobile SQLite Authority Smoke Test

## 준비

1. 최신 development build를 Android 또는 iOS 기기에 설치한다.
2. DEV Supabase 계정 A로 로그인한다.
3. TASK-052 제품 경로 전환 전에는 화면 대신 authority adapter 테스트와 DB 생성 여부를 확인한다.

## 자동 검증

```bash
pnpm --filter nexvoy-app test:authority
pnpm --filter nexvoy-app typecheck
pnpm --filter nexvoy-app lint
pnpm --filter nexvoy-app build
pnpm --filter nexvoy-app build:development:android:local
```

## 기기 Smoke

1. 앱을 실행하고 계정 A로 로그인한다.
2. 앱을 background로 보냈다가 foreground로 복귀한다. 앱 종료나 반복 flush 오류가 없어야 한다.
3. 비행기 모드를 켰다가 끈다. reconnect 시 authority flush가 한 번 재개되어야 한다.
4. 로그아웃 후 계정 B로 로그인한다. 계정 A namespace의 resource/outbox가 계정 B 조회에 노출되면 안 된다.
5. 계정 A로 다시 로그인한다. logout만으로 계정 A cache가 삭제되면 안 된다.
6. 회원 탈퇴를 완료하면 계정 A의 `authority_resources`, `authority_outbox`, `authority_sync_state`가 모두 삭제되어야 한다.

Android debug build에서는 필요 시 `adb shell run-as xyz.nexvoy.app`로 앱 DB 디렉터리를 확인한다. OS background 실행은 보장하지 않으므로 중단된 `sending` row가 다음 foreground에서 `retryable`로 회수되는지를 최종 기준으로 삼는다.

## TASK-052 인계

- 화면 repository는 `getMobileAuthorityStore()`를 사용한다.
- mutation commit 후 `notifyMobileAuthorityMutationCommitted()`를 호출한다.
- 상세 화면 진입/해제 시 `watchMobileAuthorityResource()` 구독을 생성하고 해제한다.
- 멤버 revoke 시 `purgeMobileAuthorityResource()`로 해당 cache/outbox와 Realtime 구독을 제거한다.
