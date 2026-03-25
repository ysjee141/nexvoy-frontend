# ADR-001 구현 작업 계획서 (Task Plan)

본 문서는 ADR-001(일정 알람 기능 및 오프라인 대응)을 실제 코드로 구현하기 위한 단계별 태스크를 정의합니다.

## 1단계: 백엔드 및 인프라 (Supabase)

### 1-1. DB 스키마 업데이트
- `public.plans` 테이블에 `alarm_sent_at` 컬럼 추가 (TIMESTAMPTZ)
- 중복 알람 방지를 위한 인덱스 고려

### 1-2. Edge Function 개발 (`check-pending-alarms`)
- **Query**: `(start_datetime_local - alarm_minutes_before)`가 현재 시각(1분 오차 범위) 내에 있는 대상 추출
- **Email**: Resend API를 연동하여 알림 메일 발송 기능 추가
- **Push**: FCM Data-only 푸시 발송 큐 구현

### 1-3. 스케줄러 등록
- Supabase Cron 기능을 사용하여 `1 * * * *` (매분) 실행 설정

## 2단계: 앱 클라이언트 (Capacitor/Next.js)

### 2-1. 로컬 알림 동기화 엔진 (`NotificationManager.ts`)
- `@capacitor/local-notifications` 플러그인 랩핑
- 모든 가용 일정에 대해 `schedule()` 호출
- 앱 라이프사이클(App State Change)에 따른 동기화 트리거

### 2-2. 충돌 방지 로직
- 푸시 수신 인터셉터 구현
- 로컬 알림 ID와 푸시 ID의 일관성 유지 (Hashing function)

## 3단계: 테스트 및 안정성 검증
- 비행기 모드 시나리오 테스트
- 타임존 변경(국가 이동) 시 알림 정확도 테스트
- 배터리 최적화 모드에서의 로컬 알람 동작 확인

---
*작성일: 2026-03-25*
