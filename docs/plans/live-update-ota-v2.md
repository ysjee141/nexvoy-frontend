# Live Update (OTA) 구현 계획서 v2 (Manual with Supabase)

본 문서는 외부 유료 서비스(Capgo Cloud) 대신 **Supabase(Storage + DB)**를 직접 활용하여 비용 없이 구축하는 **수동 Live Update (OTA)** 시스템 계획을 기술합니다.

## 1. 개요 (Overview)
- **목적**: Supabase 인프라를 활용해 추가 비용 없이 실시간 앱 업데이트 환경 구축.
- **주요 기술**: 
  - `@capgo/capacitor-updater` (Capacitor 전용 플러그인, 수동 모드).
  - **Supabase Storage**: 빌드된 `.zip` 번들 저장.
  - **Supabase Database**: 버전 관리 테이블 (`app_versions`).
- **작동 방식**: 앱 시작 시 DB에서 최신 버전을 조회하고, 현재 버전보다 높을 경우 Storage에서 번들을 다운로드하여 즉시 반영.

---

## 2. 인프라 설정 (Infrastructure Setup)

### 2.1. Supabase Database (`app_versions`)
최신 버전을 추적하기 위한 테이블을 생성합니다.

```sql
create table public.app_versions (
  id uuid default gen_random_uuid() primary key,
  version text not null unique,        -- 예: '1.0.1'
  bundle_url text not null,            -- Storage의 .zip 파일 공개 URL
  is_active boolean default true,      -- 활성화 여부
  min_native_version text,             -- 최소 지원 네이티브 앱 버전 (예: '1.0.0')
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 인덱스 추가 (조회 성능 최적화)
create index idx_app_versions_active on public.app_versions(is_active) where is_active = true;
```

### 2.2. Supabase Storage
- **Bucket Name**: `app-updates`
- **Access Control**: `Public` (앱에서 다운로드하기 위함) 또는 `Authenticated` (보안 강화 시) 선택.
- **Structure**: `bundles/[version].zip`

---

## 3. 구현 단계 (Implementation Steps)

### 3.1. 의존성 및 설정
- **플러그인 설치**:
  ```bash
  pnpm add @capgo/capacitor-updater
  npx cap sync
  ```
- **[capacitor.config.ts](file:///Users/ysjee141/mySources/travel-pack/capacitor.config.ts)**:
  - `CapacitorUpdater` 플러그인의 `autoUpdate`를 `false`로 명시.
  ```typescript
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
  ```

### 3.2. 업데이트 로직 개발 (`useOTAUpdate`)
- **`src/hooks/useOTAUpdate.ts`** (가칭):
  - 앱 시작 시 실행될 로커직.
  - **순서**: 
    1. `CapacitorUpdater.notifyAppReady()` 호출 (현재 번들 안정성 확인).
    2. Supabase DB에서 `is_active = true`인 가장 최신 `version` 조회.
    3. 현재 앱 버전(App 플러그인 또는 Preferences 저장값)과 비교.
    4. 필요 시 `CapacitorUpdater.download({ url, version })` 실행.
    5. 다운로드 완료 후 `CapacitorUpdater.set({ version })` 호출하여 앱 재시작.

### 3.3. UI 통합
- **`src/components/layout/UpdateOverlay.tsx`**:
  - `useOTAUpdate` 상태에 따라 "업데이트 다운로드 중..." 화면 표시.
  - Next.js의 `RootLayout`에서 최상위에 배치.

---

## 4. 운영 프로세스 (Operation Flow)

### 4.1. 배포 (Deploy)
1. **빌드**: `pnpm build:mobile` 실행 (Next.js static export).
2. **압축**: `out/` 폴더의 내용을 `dist.zip`으로 압축.
3. **업로드**: 
   - Supabase Storage `app-updates` 버킷에 `bundles/1.0.1.zip` 업로드.
   - 업로드된 파일의 Public URL 복사.
4. **DB 갱신**: `app_versions` 테이블에 새 레코드 추가.
   ```sql
   insert into app_versions (version, bundle_url) 
   values ('1.0.1', 'https://[REF].supabase.co/storage/v1/object/public/app-updates/bundles/1.0.1.zip');
   ```

### 4.2. 롤백 (Rollback)
- DB에서 해당 버전의 `is_active`를 `false`로 변경하면 사용자는 즉시 이전 버전으로 유지되거나 롤백됨.

---

## 5. 배포 파이프라인 (CI/CD Pipeline)

GitHub Actions를 활용해 빌드부터 DB 업데이트까지 자동화하는 흐름을 구축합니다.

### 5.1. 자동화 스크립트 (`scripts/deploy-ota.mjs`)
빌드 결과물을 압축하고 Supabase에 업로드하는 Node.js 스크립트를 작성합니다.

```javascript
// 주요 로직 요약
// 1. package.json에서 버전 추출
// 2. 'out' 폴더를 '[version].zip'으로 압축
// 3. Supabase SDK를 사용하여 Storage에 업로드
// 4. app_versions 테이블에 새 레코드 insert
```

### 5.2. GitHub Actions 워크플로우
명령어 하나로 배포가 가능하도록 구성합니다.

```yaml
name: Deploy OTA Update
on:
  workflow_dispatch: # 수동 실행
    inputs:
      version:
        description: '배포할 버전 (예: 1.0.1)'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Pnpm
        uses: pnpm/action-setup@v2
      - name: Build Mobile
        run: pnpm build:mobile
      - name: Run Deploy Script
        run: node scripts/deploy-ota.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          APP_VERSION: ${{ github.event.inputs.version }}
```

---

## 6. 장단점 분석

| 구분 | 장점 | 단점 |
| :--- | :--- | :--- |
| **비용** | **완전 무료** (Supabase 무료 범위 내) | 직접 DB/Storage 관리 필요 |
| **제어권** | 업데이트 타이밍과 대상을 100% 직접 제어 가능 | 초기 파이프라인 구축 공수 필요 |
| **보안** | Supabase Auth와 연동하여 업데이트 접근 제어 가능 | Capgo 대시보드 같은 전용 UI 없음 |

---

## 7. 향후 과제
- **부분 배포**: 특정 유저 이메일이나 ID에 대해서만 먼저 OTA를 적용하는 실험 기능.
- **네이티브 버전 체크**: 특정 네이티브 앱 버전 이상에서만 동작하도록 하는 로직 정교화.

> [!IMPORTANT]
> **네이티브 변경 주의**: 네이티브 코드(Java, Kotlin, Swift)나 새 플러그인이 추가된 경우에는 반드시 스토어 배포가 필요합니다. OTA는 웹 자원(HTML/JS/CSS) 변경에만 유효합니다.
