-- 1. pg_cron 확장 활성화 (이미 되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 기존 동일 이름의 크론 잡 삭제 (존재할 경우에만)
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'check-pending-alarms-cron';

-- 3. 크론 잡은 운영 환경에서만 등록
-- 로컬/테스트 환경에서는 적용하지 않음 (Edge Function URL과 service_role 키가 환경별로 다름)
-- 운영 적용 시 Supabase 대시보드 또는 별도 스크립트로 수동 등록할 것
