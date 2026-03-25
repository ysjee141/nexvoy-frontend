import { createClient } from 'npm:@supabase/supabase-js@2';
import { JWT } from "npm:google-auth-library@9";

// Setup Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Resend Config
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  try {
    console.log("Checking for pending alarms...");

    // 1. Query plans that need an alarm
    // Logic: (start_datetime_local - alarm_minutes_before) <= Local Now
    const { data: pendingAlarms, error: fetchError } = await supabase
      .rpc('get_pending_alarms'); // Using RPC for complex date logic in SQL

    if (fetchError) throw fetchError;

    if (!pendingAlarms || pendingAlarms.length === 0) {
      return new Response(JSON.stringify({ message: "No pending alarms found." }), { status: 200 });
    }

    console.log(`Found ${pendingAlarms.length} pending alarms. Processing...`);

    const results = [];

    // 2. Process each alarm
    for (const alarm of pendingAlarms) {
      const { plan_id, title, user_id, email, fcm_tokens, trip_destination } = alarm;
      
      const alarmResults: any = { plan_id, push: null, email: null };

      // A. Send Push Notifications
      if (fcm_tokens && fcm_tokens.length > 0) {
         try {
           const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${supabaseServiceKey}`
             },
             body: JSON.stringify({
               tokens: fcm_tokens,
               title: '일정 알림 ⏰',
               body: `잠시 후 "${title}" 일정이 시작됩니다. (${trip_destination})`,
               data: { planId: plan_id }
             })
           });
           alarmResults.push = pushRes.ok ? "success" : "failed";
         } catch (e) {
           console.error(`Push fail for ${plan_id}:`, e);
           alarmResults.push = "error";
         }
      }

      // B. Send Email via Resend
      if (email && RESEND_API_KEY) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: 'Onvoy Alarms <no-reply@app.nexvoy.xyz>',
              to: [email],
              subject: `[Onvoy] 일정 알림: ${title}`,
              html: `<p>안녕하세요. 설정하신 일정 알림입니다.</p>
                     <h3>${title}</h3>
                     <p>장소: ${alarm.location || '미정'}</p>
                     <p>잠시 후 일정이 시작될 예정입니다. 준비해 주세요!</p>
                     <p>여행지: ${trip_destination}</p>`
            })
          });
          alarmResults.email = emailRes.ok ? "success" : "failed";
        } catch (e) {
          console.error(`Email fail for ${plan_id}:`, e);
          alarmResults.email = "error";
        }
      }

      // C. Mark as sent
      await supabase
        .from('plans')
        .update({ alarm_sent_at: new Date().toISOString() })
        .eq('id', plan_id);

      results.push(alarmResults);
    }

    return new Response(JSON.stringify({ results }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Critical error in alarm checker:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
