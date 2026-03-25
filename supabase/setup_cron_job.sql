-- 1. pg_cron 확장 활성화 (이미 되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 기존 동일 이름의 크론 잡 삭제 (존재할 경우에만)
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'check-pending-alarms-cron';

-- 3. 1분마다 check-pending-alarms Edge Function을 호출하도록 등록
-- Note: 'runbcaegpefqnljsswhv'는 현재 프로젝트의 레퍼런스 ID입니다.
-- Note: Authorization Header에는 서비스 롤 키(service_role)를 넣어야 정상 작동합니다.
SELECT cron.schedule(
  'check-pending-alarms-cron', -- 크론 이름
  '* * * * *',                -- 매 분마다 실행
  $$
  SELECT net.http_post(
    url := 'https://runbcaegpefqnljsswhv.supabase.co/functions/v1/check-pending-alarms',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bmJjYWVncGVmcW5sanNzd2h2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYyOTIyNCwiZXhwIjoyMDg3MjA1MjI0fQ.n9oW3Oda8rEW10A5mPvHOml8Z2XBGfdXz1TDFvNzSAE"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
