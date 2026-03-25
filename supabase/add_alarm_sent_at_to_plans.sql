-- Add alarm_sent_at column to public.plans table
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS alarm_sent_at TIMESTAMP WITH TIME ZONE;

-- Create an index to optimize searching for unsent alarms
CREATE INDEX IF NOT EXISTS idx_plans_alarm_minutes_before_sent_at 
ON public.plans (alarm_minutes_before, alarm_sent_at) 
WHERE alarm_minutes_before IS NOT NULL AND alarm_sent_at IS NULL;

-- RPC to get pending alarms
CREATE OR REPLACE FUNCTION get_pending_alarms()
RETURNS TABLE (
  plan_id UUID,
  title TEXT,
  location TEXT,
  user_id UUID,
  email TEXT,
  timezone_string TEXT,
  fcm_tokens TEXT[],
  trip_destination TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.title, 
    p.location, 
    t.user_id, 
    pr.email, 
    p.timezone_string, 
    array_agg(DISTINCT d.fcm_token) FILTER (WHERE d.fcm_token IS NOT NULL) as fcm_tokens,
    t.destination
  FROM public.plans p
  JOIN public.trips t ON p.trip_id = t.id
  JOIN public.profiles pr ON t.user_id = pr.id
  LEFT JOIN public.user_devices d ON t.user_id = d.user_id
  WHERE 
    p.alarm_minutes_before IS NOT NULL 
    AND p.alarm_sent_at IS NULL
    AND (now() AT TIME ZONE p.timezone_string) >= (p.start_datetime_local - (p.alarm_minutes_before || ' minutes')::interval)
    AND p.start_datetime_local > (now() AT TIME ZONE p.timezone_string - interval '1 day')
  GROUP BY p.id, p.title, p.location, t.user_id, pr.email, p.timezone_string, t.destination;
END;
$$;
