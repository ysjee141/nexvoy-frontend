# TASK-060 Web·Android 통합 검증 Runbook

## 목적

DEV `ivgkqzwosbjukonlpfdw`에서 Web과 Android가 같은 canonical row, revision, 권한, offline
outbox와 asset 결과로 수렴하는지 검증한다. Simulator는 사전 Gate이며 Android 실제 기기 Gate를
대체하지 않는다. iOS 제품 검증은 `TASK-064`로 이관한다.

## 1. 안전 경계

- endpoint가 DEV project ref와 정확히 일치하는지 실행 전 확인한다.
- Production, 고객 계정·데이터, service-role 제품 세션을 사용하지 않는다.
- Gmail `+task060-*` 별칭과 `QA-<short-sha>-<case-id>` fixture만 사용한다.
- UUID, token, 이메일, 초대 코드, secret은 증적에서 마스킹한다.
- Firebase config, credential 파일, APK/archive는 Git에 커밋하지 않는다.

## 2. Inventory와 계정

```bash
pnpm test:task060:inventory
pnpm task060:accounts:provision
```

Inventory는 `_workspace/task060/evidence`에 mode `0600` JSON을 저장한다. 계정 도구는
`apps/web/.env.test.local`이 정확한 DEV host를 가리킬 때만 동작하며, owner/editor/viewer/
outsider/mismatch 계정을 만든다. 공유 비밀번호는 `_workspace/task060/credentials.json`에 mode
`0600`으로만 저장한다.

검증 종료 후 계정, QA 데이터와 등록된 장소 사진을 정리한다.

```bash
pnpm task060:accounts:delete
```

## 3. 자동 Gate

```bash
pnpm test:production:p0
pnpm typecheck
pnpm build:packages
pnpm build:web
pnpm build:mobile
pnpm lint:mobile
pnpm --dir apps/mobile exec expo install --check
```

하나라도 실패하면 설치 검증을 중단하고 결함을 수정한다.

## 4. DEV 초대 함수

Mobile 이메일 초대는 Web Preview API가 아니라 현재 Supabase 프로젝트의
`send-document-invitation`을 호출한다. DEV에서만 다음 secret과 함수를 설정한다.

```bash
supabase secrets set \
  --project-ref ivgkqzwosbjukonlpfdw \
  RESEND_API_KEY=... \
  ONVOY_APP_ORIGIN=https://preview.nexvoy.xyz
supabase functions deploy send-document-invitation \
  --project-ref ivgkqzwosbjukonlpfdw
```

실행 후 owner JWT로 초대를 생성하고 이메일 발송, `list_document_pending_invitations` 조회,
초대 취소를 확인한다. secret 값, JWT, token과 초대 코드는 증적에 남기지 않는다. Production에는
이 단계의 명령을 실행하지 않으며 TASK-063 승인을 따른다.

## 5. Preview Build

```bash
pnpm --filter nexvoy-app build:preview:android:local
pnpm --filter nexvoy-app build:preview:ios-simulator:local
```

wrapper는 `.env.local`의 `EXPO_PUBLIC_*` 값을 build profile에 임시 주입하고 Firebase 파일을
archive에 포함한 뒤 설정을 원복한다. iOS에서 `Build successful`과 archive 생성 이후 cleanup
`ENOTEMPTY`가 발생하면 곧바로 실패로 단정하지 말고 archive hash, 압축 해제, app 설치·실행을
검증해 build 결과와 wrapper 정리 오류를 분리한다.

## 6. Simulator 사전 Gate

Android AVD 두 대:

```bash
$HOME/Library/Android/sdk/emulator/emulator -avd Pixel_9_Pro
$HOME/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_35
$HOME/Library/Android/sdk/platform-tools/adb devices -l
```

iOS 비차단 회귀 검사:

```bash
open -a Simulator
xcrun simctl boot "iPhone 16 Pro"
xcrun simctl boot "iPhone 16e"
xcrun simctl list devices booted
```

Android 출시 필수 회귀 항목:

- Mobile 생성 entity ID가 UUID v4인지 확인한다.
- 일정 사진 upload 전에 plan command가 canonical row로 반영되는지 확인한다.
- 등록 asset이 `_w240`, `_w800` 두 object와 metadata로 남는지 확인한다.
- 동일 owner의 새 설치에서 여행·일정·사진과 revision이 복구되는지 확인한다.
- viewer/revoked/outsider write, 계정 namespace 노출, offline outbox 유실이 없는지 확인한다.

Android Simulator 성공은 `PREPASS`로만 기록한다. iOS build·launch 실패는 공유 코드 회귀로
분류해 수정하지만, iOS 기능 매트릭스는 TASK-060 완료 조건에 포함하지 않는다.

## 7. Android 실제 기기 Gate

- Android 실제 기기 A1/A2와 Preview/Internal build가 필요하다.
- `W1↔W2`, `W1↔A1`, `A1↔A2`를 모두 실행한다.
- 전체 여행·일정·준비물·템플릿·초대·권한·asset 시나리오를 실행한다.
- airplane mode, background, force-stop, 앱 업데이트와 Logcat을 확인한다.
- Web에서 생성한 대상 이메일 초대가 같은 owner의 Android에서 `수락 대기`로 보이는지 확인한다.
- Android에서 생성한 이메일 초대가 Web에서도 `수락 대기`로 보이고 Alert에 객체 문자열이
  노출되지 않는지 확인한다.
- Android Google/Kakao OAuth, invitation deep link, 실제 초대 이메일 수락, push·일정 알림을
  별도 판정한다.

Android 실제 기기가 없는 조합은 `BLOCKED`로 기록하고 Android 출시 `NO-GO`를 유지한다. iOS
실기기 조합은 `DEFERRED/TASK-064`로 기록하며 Android 출시 판정에 포함하지 않는다.

## 8. 중단 조건

- 데이터 손실, 계정 간 노출, 권한 우회, 중복 canonical row
- viewer/revoked/outsider write 성공
- offline outbox 유실 또는 retry storm
- fatal crash 또는 unhandled rejection
- Web/Android asset path 불일치
- 증적에 credential이나 실제 식별자 노출
