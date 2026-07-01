# Mobile App Verification Lifecycle

OnVoy mobile app은 Expo Router 기반 React Native 앱이지만, native module을 포함하는 순간부터 Expo Go만으로는 검증할 수 없다. 특히 `react-native-webrtc` 같은 native dependency가 들어간 빌드는 EAS dev client, preview APK, 또는 prebuild된 native project에서 검증해야 한다.

이 문서는 앱 빌드, 실제 디바이스 설치, 실행, Logcat 분석까지의 표준 검증 절차를 정의한다.

---

## 1. Runtime 선택 기준

| 목적 | 권장 런타임 | Metro 필요 여부 | 사용 상황 |
|------|-------------|----------------|-----------|
| JS/UI 빠른 개발 | EAS development client | 필요 | native runtime은 고정하고 JS를 빠르게 갱신 |
| 실기기 standalone 검증 | EAS preview APK | 불필요 | 사용자가 설치할 앱과 유사한 환경 검증 |
| native 설정/Gradle 디버깅 | `expo prebuild` + Android Studio | variant에 따라 다름 | Android native project 직접 확인 |
| Expo Go | 사용 불가 | 필요 | `react-native-webrtc` 등 custom native module이 없을 때만 가능 |

`react-native-webrtc`가 포함된 현재 구성에서는 Expo Go를 검증 경로로 사용하지 않는다.

---

## 2. Development vs Preview

`development`와 `preview`는 둘 다 실제 디바이스에 설치 가능한 APK를 만들지만 검증 목적이 다르다.

| 구분 | Development build | Preview build |
|------|-------------------|---------------|
| EAS profile | `development` | `preview` |
| APK 성격 | custom dev client | standalone/internal distribution |
| Metro 필요 | 필요 | 불필요 |
| JS 갱신 | Metro reload로 빠름 | APK 재빌드 필요 |
| 용도 | 개발 중 native module 포함 앱을 반복 디버깅 | 사용자 설치와 유사한 최종 런타임 검증 |
| localhost/8081 | 정상 동작 경로 | 나오면 잘못된 빌드/실행 경로 의심 |
| Logcat 용도 | JS/native 디버깅 | 실제 APK crash 검증 |

선택 기준:

- UI/JS를 빠르게 바꾸며 확인해야 하면 `development`.
- Metro 없이 실제 배포형 실행을 검증해야 하면 `preview`.
- `react-native-webrtc` 같은 native module 존재 여부를 검증하려면 Expo Go가 아니라 둘 중 하나를 사용한다.

---

## 3. 공통 검증 단계

모바일 검증은 아래 단계를 별도로 통과해야 한다. 앞 단계 성공이 다음 단계 성공을 보장하지 않는다.

1. TypeScript 검증
   - `pnpm --filter nexvoy-app typecheck`
2. Expo JS export 검증
   - `pnpm build:mobile`
3. Native dependency 정합성 검증
   - `cd apps/mobile && pnpm exec expo install --check`
4. EAS local APK 빌드
   - development: `pnpm --filter nexvoy-app build:development:android:local`
   - preview: `pnpm --filter nexvoy-app build:preview:android:local`
5. 실제 디바이스 설치
   - `adb -s <device-serial> install -r apps/mobile/build-*.apk`
6. 실제 디바이스 실행
   - 런처에서 실행하거나 `adb -s <device-serial> shell monkey -p xyz.nexvoy.app 1`
7. Logcat 런타임 검증
   - Android Studio Logcat 또는 `adb logcat`으로 crash 원인 확인

---

## 4. Local EAS Build

`EXPO_PUBLIC_*` 값은 build time에 JS bundle에 포함된다. `eas build --local`을 직접 실행하면 local shell 환경에 따라 `apps/mobile/.env.local` 값이 Gradle bundling 단계까지 보장되지 않을 수 있다.

로컬 EAS APK는 root에서 아래 스크립트를 사용한다.

Development build:

```bash
pnpm --filter nexvoy-app build:development:android:local
```

Preview build:

```bash
pnpm --filter nexvoy-app build:preview:android:local
```

이 스크립트는 `apps/mobile/.env.local`을 읽어 프로세스 환경에 주입한 뒤 EAS local build를 실행한다. `.env.local` 파일 자체는 절대 수정하거나 커밋하지 않는다.

직접 EAS 명령을 실행해야 하는 경우, 필요한 값을 shell 환경에 먼저 주입해야 한다.

```bash
cd apps/mobile
export EXPO_PUBLIC_SUPABASE_URL="..."
export EXPO_PUBLIC_SUPABASE_ANON_KEY="..."
pnpm exec eas build --profile development --platform android --local --clear-cache
pnpm exec eas build --profile preview --platform android --local --clear-cache
```

---

## 5. Development Build 실행 흐름

Development build는 custom dev client다. APK에는 native runtime이 들어가지만 JS는 Metro에서 받아온다.

1. Development APK 빌드

```bash
pnpm --filter nexvoy-app build:development:android:local
```

2. 실제 디바이스 설치

```bash
adb -s <device-serial> install -r apps/mobile/build-*.apk
```

3. Android device에서 Metro port reverse 설정

실제 Android device에서 `localhost:8081`은 개발 PC가 아니라 device 자신을 가리킨다.
따라서 development build를 USB 또는 Wireless ADB로 검증할 때는 앱 실행 전에 Metro port를 reverse한다.

```bash
adb -s <device-serial> reverse tcp:8081 tcp:8081
```

4. Metro 실행

```bash
cd apps/mobile
pnpm start
```

5. 기기에서 앱 실행

```bash
adb -s <device-serial> shell monkey -p xyz.nexvoy.app 1
```

6. 앱이 Metro 연결 화면 또는 dev client 화면을 표시하면 개발 서버에 연결한다.

주의:

- development build에서 `localhost:8081` 또는 Metro 연결이 보이는 것은 정상이다.
- Android 실제 device에서 `localhost:8081`로 연결하려면 `adb reverse tcp:8081 tcp:8081`가 먼저 설정되어 있어야 한다.
- `adb reverse`를 쓰지 않는 경우 같은 네트워크의 PC LAN IP 기반 Metro URL을 사용한다.
- 같은 Wi-Fi가 아니거나 dev server host가 맞지 않으면 앱은 JS bundle을 못 가져온다.
- native dependency 변경 후에는 development APK를 다시 빌드해야 한다. JS/TS 변경만 있으면 Metro reload로 충분하다.

---

## 6. Preview Build 실행 흐름

Preview build는 standalone APK다. JS bundle이 APK 안에 포함되므로 Metro 없이 실행되어야 한다.

1. Preview APK 빌드

```bash
pnpm --filter nexvoy-app build:preview:android:local
```

2. 실제 디바이스 설치

```bash
adb -s <device-serial> install -r apps/mobile/build-*.apk
```

3. 앱 실행

```bash
adb -s <device-serial> shell monkey -p xyz.nexvoy.app 1
```

4. Logcat에서 crash 확인

```bash
adb -s <device-serial> logcat | rg "xyz.nexvoy.app|AndroidRuntime|ReactNativeJS|Expo|WebRTC"
```

주의:

- preview build가 `localhost:8081`을 찾으면 standalone 검증이 아니다. development/debug build를 설치했거나 잘못된 산출물을 설치했는지 확인한다.
- preview build에서 `.env.local` 값이 누락되면 `supabaseUrl is required` 같은 JS 초기화 crash가 발생한다.
- 실제 사용자가 설치할 앱과 가까운 검증은 preview APK에서 수행한다.

---

## 7. APK 산출물 관리

EAS local build는 `apps/mobile/build-*.apk`를 생성한다. 이 파일은 검증 산출물이며 git에 커밋하지 않는다.

설치 예시:

```bash
adb -s <device-serial> install -r apps/mobile/build-1782853409754.apk
```

여러 기기나 emulator가 연결되어 있으면 `adb install`은 실패한다.

```text
adb: more than one device/emulator
```

이 경우 `adb devices`로 serial을 확인하고 `-s`를 붙인다.

```bash
adb devices
adb -s 192.168.0.23:39555 install -r apps/mobile/build-*.apk
```

---

## 8. Wireless Debugging

USB 없이 Wi-Fi로 설치하려면 Android 11 이상에서 Wireless debugging을 사용한다.

1. Android 기기에서 개발자 옵션 > Wireless debugging 활성화
2. Pairing code로 기기 페어링
3. 로컬에서 pairing

```bash
adb pair <pairing-ip>:<pairing-port>
```

4. 연결용 port로 connect

```bash
adb connect <device-ip>:<connect-port>
adb devices
```

5. 특정 디바이스에 설치

```bash
adb -s <device-ip>:<connect-port> install -r apps/mobile/build-*.apk
```

---

## 9. Logcat 확인

Android Studio:

1. Android Studio 실행
2. Logcat 탭 열기
3. 연결된 device 선택
4. 앱 프로세스 `xyz.nexvoy.app` 선택

CLI:

```bash
adb -s <device-serial> logcat | rg "xyz.nexvoy.app|AndroidRuntime|ReactNativeJS|Expo|WebRTC"
```

Crash 분석 시 가장 먼저 `FATAL EXCEPTION`, `JavascriptException`, `NoClassDefFoundError`, `Unable to resolve`, `Cannot find module`을 찾는다.

---

## 10. 자주 발생한 실패와 원인

### 10.1 `createBundleReleaseJsAndAssets` 실패

증상:

```text
Execution failed for task ':app:createBundleReleaseJsAndAssets'
```

가능 원인:

- pnpm monorepo에서 Gradle bundler가 Expo Router entry를 잘못 해석
- Metro가 `@/` TypeScript path alias를 해석하지 못함
- Gradle bundling 단계에서 `metro-runtime`, `babel-preset-expo`가 직접 resolve되지 않음

대응:

- mobile/root entry shim 유지
- `apps/mobile/metro.config.js`의 alias resolver 유지
- SDK에 맞는 `babel-preset-expo`와 Metro runtime 명시 dependency 유지

### 10.2 `NoClassDefFoundError`

증상:

```text
java.lang.NoClassDefFoundError: Failed resolution of: Lexpo/modules/kotlin/types/AnyTypeCache;
```

가능 원인:

- Expo SDK와 native package 버전 불일치
- 예: `expo-clipboard`가 SDK 54 기대 버전과 맞지 않음

대응:

```bash
cd apps/mobile
pnpm exec expo install --check
pnpm exec expo install <outdated-package-list>
```

### 10.3 `supabaseUrl is required`

증상:

```text
com.facebook.react.common.JavascriptException: Error: supabaseUrl is required.
```

가능 원인:

- APK bundle 생성 시 `EXPO_PUBLIC_SUPABASE_URL` 또는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 주입되지 않음

대응:

- `apps/mobile/.env.local`에 값이 있는지 확인
- local EAS build는 `pnpm --filter nexvoy-app build:development:android:local` 또는 `pnpm --filter nexvoy-app build:preview:android:local` 사용
- remote EAS build는 EAS secrets/environment variables에 `EXPO_PUBLIC_*` 값을 등록

### 10.4 앱이 `localhost:8081`을 찾음

가능 원인:

- development client 또는 debug build를 실행 중
- Metro server가 필요한 런타임을 standalone 앱처럼 설치함

대응:

- standalone 검증은 preview APK 사용
- development client 검증은 Metro server를 함께 실행

```bash
cd apps/mobile
pnpm start
```

---

## 11. Android Studio 사용 기준

Android Studio는 다음 용도로 사용한다.

- APK 열기: `File > Profile or Debug APK...`
- Logcat 확인
- `expo prebuild --platform android` 후 native project 열기

단, `apps/mobile/android` 폴더는 기본적으로 repo에 존재하지 않는다. 필요한 경우 로컬에서 생성한다.

```bash
cd apps/mobile
pnpm exec expo prebuild --platform android
```

prebuild된 `android/`를 커밋할지는 별도 아키텍처 결정이 필요하다. 단순 Logcat/설치 확인 목적이라면 EAS preview APK + Android Studio Logcat 조합을 우선한다.

---

## 12. 완료 기준

모바일 native 영향 변경은 최소한 아래를 통과해야 한다.

- `pnpm --filter nexvoy-app typecheck`
- `pnpm build:mobile`
- `cd apps/mobile && pnpm exec expo install --check`
- native module 개발 중 빠른 반복 검증: `pnpm --filter nexvoy-app build:development:android:local`
- `pnpm --filter nexvoy-app build:preview:android:local`
- preview APK를 실제 Android device에 설치 후 앱이 첫 화면까지 표시됨
- Logcat에 `FATAL EXCEPTION`, `JavascriptException`, native module load error가 없음
