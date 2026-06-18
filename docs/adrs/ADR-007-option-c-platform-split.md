# ADR-007: 웹/앱 완전 분리 아키텍처 채택 (Option C)

- 상태: 제안됨
- 결정일: 2026-06-19
- 결정자: ysjee141
- 관련 문서: `docs/rebuild-analysis.md`, `docs/plans/PLAN-007-option-c-rebuild.md`

---

## 컨텍스트

OnVoy는 현재 Next.js 16 + Capacitor 8 단일 코드베이스로 웹과 모바일 앱을 동시에 서빙한다.
이 구조는 다음 구조적 한계를 갖는다.

1. **로딩 딜레이**: `/trips/detail` 진입 시 0.5~1s 딜레이. 전체 Client Component 구조이므로 hydration + Supabase 쿼리 두 번의 네트워크 왕복이 발생한다. `@supabase/ssr`이 이미 deps에 있으나 `output: 'export'` (정적 내보내기) 강제로 Server Components를 사용할 수 없다.

2. **빌드 복잡도**: 모바일 빌드 시 `prebuild`/`postbuild` 스크립트로 API Routes를 임시 이동 후 복원한다. 이 스크립트 실패 시 모바일 빌드 전체가 깨지며 디버깅이 어렵다.

3. **Capacitor 결합도**: 13개 Service 중 9개가 Capacitor 의존으로 웹 전용 테스트가 어렵다. `Capacitor.isNativePlatform()` 분기가 19개 파일에 분산되어 있다.

4. **플랫폼 제약 중복**: Sentry Tunnel Route 불가 (정적 내보내기), Image Optimization 비활성 (`unoptimized: true`), Server Components 사용 불가 등이 웹 성능을 제약한다.

서비스가 정식 오픈 전이고 운영 사용자가 없으므로 마이그레이션 부담 없이 아키텍처를 전환할 수 있는 최적 시점이다.

---

## 검토한 선택지

### Option A — 현상 유지 + React Query 캐시 추가
- 장점: 추가 공수 없음, 빠른 출시
- 단점: 근본 딜레이 해소 불가, 기술 부채 누적 (빌드 스크립트, Capacitor 결합도)
- 탈락 이유: 오픈 전 시점에 기술 부채 위에 출시하면 이후 전환 비용이 더 크다.

### Option B — SSR 강화 (Capacitor 유지)
- 장점: 웹 성능 개선 가능
- 단점: 같은 페이지에 웹(RSC)/앱(Client) 두 경로가 생겨 20개 페이지에 복잡도 증가. API Routes 이동 스크립트 증가. 앱 성능 개선 없음.
- 탈락 이유: Option C와 유사한 복잡도를 갖되 앱 성능은 그대로인 최악의 조합이 될 수 있다.

### Option C — 웹(Next.js SSR) + 앱(React Native) 완전 분리 ← **채택**

### Option D — 앱 전용 (React Native Only)
- 장점: 단일 코드베이스, 공수 최소
- 단점: 웹 접근성 상실, 공유 링크 앱 미설치 시 진입 불가, SEO 불가
- 탈락 이유: 공유 링크·협업 초대 UX가 핵심 기능이고, SEO 유입 채널 가능성을 닫기엔 이르다.

---

## 결정

**Option C — 웹/앱 완전 분리**를 채택한다.

```
nexvoy/ (pnpm monorepo)
├── packages/
│   ├── types/    @nexvoy/types — 도메인 타입 SSOT
│   └── core/     @nexvoy/core — 플랫폼 독립 비즈니스 로직
└── apps/
    ├── web/      nexvoy-web — Next.js 16 SSR
    └── mobile/   nexvoy-app — React Native / Expo
              ↕
         Supabase (공유 DB, 기존 스키마/RLS 유지)
```

- 웹: `output: 'export'` 제거 → Server Components + SSR 풀 활용
- 앱: Capacitor → React Native/Expo 전환 → 네이티브 렌더링
- 공유: `@nexvoy/types`, `@nexvoy/core` workspace 패키지

---

## 기대 효과

| 항목 | 현재 | 개선 후 |
|------|------|--------|
| trips/detail 초기 로딩 | 0.5~1s | 100~200ms (RSC prefetch) |
| Sentry 모바일 오류 추적 | 불가 (정적 내보내기 제약) | `@sentry/react-native`로 정상 |
| Image Optimization | 비활성 (모바일 빌드) | 웹에서 완전 활성 |
| `Capacitor.isNativePlatform()` 분기 | 19파일 | 0 (플랫폼 분리로 소멸) |
| API Routes 빌드 스크립트 | 복잡한 `mv` 방식 | 폐기 |
| 앱 스크롤/애니메이션 | WebView 한계 | 네이티브 렌더링 |

---

## 위험 요소 및 완화

| 위험 | 완화 |
|------|------|
| RN 화면 20개 재작성 공수 과소평가 | 핵심 5화면 완성 후 재추정. RN 표준 컴포넌트 우선 |
| 1인 개발 두 플랫폼 동시 유지 | 순차 진행 (P1 웹 완성 후 P2 앱 착수) |
| Google Maps 웹/앱 API 상이 | 데이터 가공만 `@nexvoy/core` 공유, UI는 분리 |
| 환경변수 혼동 | `NEXT_PUBLIC_*` (웹) vs `EXPO_PUBLIC_*` (앱) 명명 규칙 분리 |

---

## 후속 과제

- Phase 0~3 완료 후 현재 `travel-pack` 리포 아카이브 처리
- 웹 유입 데이터 확보 후 Option D (앱 전용) 재검토 여부 판단
- Supabase Free → Pro 업그레이드 시점 결정 (MAU 기준)
