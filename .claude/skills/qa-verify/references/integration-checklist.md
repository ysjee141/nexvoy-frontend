# OnVoy 통합 정합성 상세 체크리스트

## Service <-> 컴포넌트 (프론트엔드)
- [ ] Service 메서드 반환 타입 <-> 컴포넌트 사용 타입 일치
- [ ] Zustand store shape <-> 컴포넌트 selector 반환 타입 일치
- [ ] 옵셔널 필드 null/undefined 처리 양쪽 일관성
- [ ] Service 에러 반환 -> 컴포넌트 에러 핸들링 존재
- [ ] TypeScript 제네릭 캐스팅으로 타입 우회 없음
- [ ] Service 호출 시 인자 타입과 Service 메서드 파라미터 타입 일치

## Supabase <-> Service (백엔드)
- [ ] 테이블 컬럼명 <-> Service 타입 정의 일치
- [ ] RLS 정책이 모든 CRUD 시나리오 커버
  - [ ] SELECT: 본인 데이터 + 협업자 데이터 + 공개 데이터
  - [ ] INSERT: 본인만
  - [ ] UPDATE: 본인만 (또는 협업자 권한에 따라)
  - [ ] DELETE: 본인만
- [ ] auth.uid() 기반 접근 제어 빈틈 없음
- [ ] Edge Function 호출 시 인증 토큰 전달 및 검증
- [ ] Storage RLS: 버킷별 접근 정책 일치

## 라우팅
- [ ] 모든 href/router.push 값이 실제 `src/app/` page 파일 경로와 매칭
- [ ] 동적 세그먼트 [id]가 올바른 파라미터로 채워짐
- [ ] route group ((group)) URL에서 제거 고려한 경로 검증
- [ ] redirect() 호출 대상 경로 존재 여부
- [ ] 404 발생 가능 경로 없음

## Storage
- [ ] 여행 자산 경로: `trips/[user_id]/[trip_id]/[filename]`
- [ ] 프로필 이미지 경로: `profiles/[user_id]/avatar_[timestamp].jpg`
- [ ] 업로드 전 경로 형식 검증 로직 존재
- [ ] Storage 버킷 RLS와 테이블 RLS 정합

## 도메인 관계
- [ ] Trip -> Plan: trip_id 참조 무결성, 삭제 시 cascade 또는 보호
- [ ] Trip -> Checklist: trip_id 참조 무결성
- [ ] Trip -> Collaborator: 초대/수락/거부 플로우 완전성
- [ ] User -> Template: is_public 기반 공유 범위 일관성
- [ ] Template -> Checklist Item: 템플릿 적용 시 아이템 복사 정합

## 플랫폼 분기
- [ ] 네트워크 요청: 웹 fetch / 모바일 CapacitorHttp 분기
- [ ] 알림: 모바일 Local Notifications + Push Notifications 설정
- [ ] 공유: 웹 Web Share API / 모바일 Native Share 분기
- [ ] Safe Area: 모바일 환경 상단(notch)/하단(home button) 패딩
- [ ] 스플래시 스크린: SplashScreen.hide() 호출 시점
- [ ] 상태바: StatusBar 스타일 설정

## 외부 서비스 연동
- [ ] FCM 푸시: 토큰 등록/갱신 플로우 정상
- [ ] Resend 이메일: 발송 실패 시 폴백 처리
- [ ] Discord Webhook: 피드백 전송 형식 일관성
- [ ] GA4/Firebase Analytics: 이벤트 파라미터 형식 일관성
- [ ] Capgo OTA: 업데이트 체크/적용 플로우 정상
