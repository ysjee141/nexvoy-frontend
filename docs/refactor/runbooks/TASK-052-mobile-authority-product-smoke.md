# TASK-052 Mobile Authority Product Smoke Test

## 준비

1. 최신 Android/iOS development build와 DEV Supabase를 사용한다.
2. 동일 여행의 owner 계정 A, collaborator 계정 B, Web 브라우저를 준비한다.
3. 기본 authority mode에서 시작한다. 롤백 검증 때만 `EXPO_PUBLIC_MOBILE_SERVER_AUTHORITY=0`을 사용한다.

## 자동 검증

```bash
pnpm --filter @nexvoy/core test
pnpm --filter nexvoy-app test:authority
pnpm typecheck
pnpm --filter nexvoy-app lint
pnpm build
pnpm build:mobile
EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP=1 pnpm --filter nexvoy-app build:development:android:local
```

`expo-doctor` 우회는 기존 app config, Metro, 직접 설치된 native module 경고에만 사용한다. Gradle native compile과 APK packaging은 반드시 성공해야 한다.

## 기기 Smoke

1. Web 계정 A에서 여행을 생성한다. 새 Mobile 설치에서 로그인 후 foreground 갱신만으로 여행이 보여야 한다.
2. Mobile을 비행기 모드로 전환하고 여행, 일정, 준비물, 템플릿을 생성·수정·삭제한다. 화면에는 즉시 반영되고 상태는 `오프라인 저장` 또는 `저장 대기`여야 한다.
3. 네트워크를 복구한다. 상태가 `동기화 완료`로 바뀌고 Web 계정 A에도 동일한 canonical 데이터가 보여야 한다.
4. Mobile 상세를 연 상태에서 Web 계정 B가 일정이나 준비물을 변경한다. Realtime invalidation 후 Mobile이 새 revision을 읽어야 한다.
5. Mobile에서 새 여행을 만든 직후 첫 ack까지 초대와 이미지 업로드가 비활성화되고, ack 이후 정상 활성화되는지 확인한다.
6. 로그아웃 후 계정 B로 로그인한다. 계정 A cache/outbox가 노출되지 않아야 한다. 계정 A 재로그인 시 보존된 cache가 복구되어야 한다.
7. authority mode 제품 동작 중 document key, encrypted backup, Yjs signaling 요청이나 반복 오류가 없어야 한다.
8. `EXPO_PUBLIC_MOBILE_SERVER_AUTHORITY=0` build에서 기존 document-primary adapter로 롤백되는지 확인한다.

## 합격 기준

- offline mutation은 앱 재시작 후에도 outbox에 남고 reconnect 후 canonical row에 수렴한다.
- Web/Mobile과 두 계정 사이에 데이터 누락·혼합이 없다.
- conflict/permission/terminal error는 대기 상태로 위장되지 않고 명시적으로 표시된다.
- OS background 완료를 전제하지 않으며 foreground 복귀가 최종 복구 경로로 동작한다.
