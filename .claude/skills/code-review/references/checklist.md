# OnVoy 코드 리뷰 상세 체크리스트

## 아키텍처

### 레이어 분리
- [ ] View(컴포넌트)에서 직접 Supabase DB 쿼리 없음
- [ ] 비즈니스 로직이 `src/services`에 위치
- [ ] Service는 클래스 기반 싱글톤 패턴 준수
- [ ] Server/Client 컴포넌트 용도 구분 (서버 사이드 데이터 인출 vs 사용자 인터랙션)

### 상태 관리 (Zustand)
- [ ] UI 상태(모달, 알림, 로딩)와 데이터 상태(프로필, 세션) 분리
- [ ] 세션 유지 필요한 상태에 persist 미들웨어 적용
- [ ] 불필요한 전역 상태 없음 (로컬로 충분한 것은 로컬에)

## 보안

### RLS 정책
- [ ] 새 테이블에 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` 적용
- [ ] Owner Policy: `user_id = auth.uid()` 기반 CRUD 권한
- [ ] 협업 기능: `collaborators` 테이블 관계형 체크로 접근 확장
- [ ] 공개 데이터: `is_public` 필드 기반 읽기 정책

### 인증 및 통신
- [ ] 인증 필요한 API에 auth 체크 존재
- [ ] HTTPS 강제 (cleartext 허용 설정 없음)
- [ ] Edge Function에서 인증 토큰 검증

## 프론트엔드

### 스타일링 (Panda CSS)
- [ ] `css()` 함수만 사용 (import from 'styled-system/css')
- [ ] `styled-system` 디자인 토큰 활용
- [ ] 하드코딩된 색상값 대신 토큰 참조
- [ ] 인라인 스타일 미사용
- [ ] Tailwind CSS 미사용

### 브랜드 컬러 (Clear Departure)
- [ ] primary-blue (#2563EB) -- CTA, 진행률 바, 활성 탭에만
- [ ] bg-base (#FFFFFF) -- 배경
- [ ] border-light (#E2E8F0) -- 구분선
- [ ] text-primary (#1E293B) -- 메인 텍스트
- [ ] text-secondary (#64748B) -- 보조 텍스트
- [ ] 과거 민트색 (#2EC4B6) 미사용

### UI/UX 규칙
- [ ] 10% Rule 준수 (색상은 클릭/진행상태에만)
- [ ] border-radius: 12px~16px
- [ ] 넉넉한 여백 (기존 대비 1.5배)
- [ ] 체크리스트 아이템: 스와이프로만 수정/삭제 노출

### 모바일 (Capacitor)
- [ ] Safe Area 패딩 (top: env(safe-area-inset-top), bottom: env(safe-area-inset-bottom))
- [ ] CapacitorHttp 활용 (CORS 우회 필요 시)
- [ ] `Capacitor.isNativePlatform()` 분기 처리
- [ ] Framer Motion 전환 효과 (있는 경우)

## 데이터

### Supabase 클라이언트 구분
- [ ] Server Components -> `src/utils/supabase/server.ts`의 `createClient`
- [ ] Client Components -> `src/utils/supabase/client.ts`
- [ ] Middleware -> `src/utils/supabase/middleware.ts`

### Storage 경로
- [ ] 여행 자산: `trips/[user_id]/[trip_id]/[filename]`
- [ ] 프로필 이미지: `profiles/[user_id]/avatar_[timestamp].jpg`

### 도메인 관계 무결성
- [ ] Trip -> Plan: trip_id 참조 무결성
- [ ] Trip -> Checklist: trip_id 참조 무결성
- [ ] Trip -> Collaborator: 공유 기능 RLS 정합
- [ ] User -> Template: 소유권 검증

## 코드 품질

### 명명 규칙
- [ ] Components: PascalCase
- [ ] Functions/Variables: camelCase
- [ ] Constants: UPPER_SNAKE_CASE
- [ ] Interfaces/Types: PascalCase (I/T 접두사 미사용)
- [ ] 절대 경로 `@/` 사용
- [ ] `any` 타입 미사용

### 성능
- [ ] 불필요한 리렌더링 방지 (useCallback, useMemo 적절 사용)
- [ ] Next.js Image 컴포넌트로 이미지 최적화
- [ ] 무거운 연산 메모이제이션
