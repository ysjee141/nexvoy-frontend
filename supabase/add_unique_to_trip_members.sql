-- trip_members 테이블에 중복 초대 방지를 위한 유니크 제약 조건 추가

-- 같은 여행(trip_id)에 같은 이메일(invited_email)이 중복 등록되지 않도록 합니다.
ALTER TABLE public.trip_members 
ADD CONSTRAINT trip_members_trip_id_invited_email_key UNIQUE (trip_id, invited_email);
