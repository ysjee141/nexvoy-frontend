// Final Version: 2026-04-23T11:38:00Z
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[DEBUG] --- Request Received ---");
    const { code, redirect_uri, mode, targetUserId } = await req.json();
    const internalSecret = req.headers.get("x-internal-secret");
    const systemSecret = Deno.env.get("INTERNAL_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const kakaoClientId = Deno.env.get("KAKAO_CLIENT_ID")!;
    const kakaoClientSecret = Deno.env.get("KAKAO_CLIENT_SECRET")!;

    // 1. 카카오 토큰 교환
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: kakaoClientId,
      client_secret: kakaoClientSecret,
      redirect_uri,
      code,
    });
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString()
    });
    if (!tokenRes.ok) throw new Error(`Kakao token failed: ${await tokenRes.text()}`);
    const { access_token } = await tokenRes.json();

    // 2. 카카오 사용자 조회
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!userRes.ok) throw new Error("Kakao user fetch failed");
    const kakaoUser = await userRes.json();
    const kakaoId = String(kakaoUser.id);
    const kakaoEmail = kakaoUser.kakao_account?.email ?? null;
    const kakaoNickname = kakaoUser.kakao_account?.profile?.nickname ?? null;
    const kakaoAvatarUrl = kakaoUser.kakao_account?.profile?.profile_image_url ?? null;

    // 3. Admin 클라이언트
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 4. 유저 정합 로직
    let userId: string | null = null;
    let finalEmail: string | null = null;
    let currentUser: any = null;

    // 연동(link)을 위한 현재 유저 식별
    if (internalSecret && systemSecret && internalSecret.trim() === systemSecret.trim() && targetUserId) {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      currentUser = user;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabaseUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseUserClient.auth.getUser();
        currentUser = user;
      }
    }

    if (mode === 'link') {
      if (!currentUser) throw new Error("Link mode requires an active session");
      userId = currentUser.id;
      finalEmail = currentUser.email;
      await supabaseAdmin.auth.admin.updateUserById(userId, { 
        app_metadata: { kakao_id: kakaoId, provider: 'kakao' }, 
        user_metadata: { ...currentUser.user_metadata, kakao_id: kakaoId } 
      });
    } else {
      const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("kakao_id", kakaoId).maybeSingle();
      if (profile) {
        userId = profile.id;
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
        finalEmail = user?.email ?? null;
      } else {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.email === kakaoEmail);
        if (existingUser) {
          userId = existingUser.id;
          finalEmail = existingUser.email!;
          await supabaseAdmin.auth.admin.updateUserById(userId, { 
            app_metadata: { kakao_id: kakaoId, provider: 'kakao' },
            user_metadata: { kakao_id: kakaoId }
          });
        } else {
          finalEmail = kakaoEmail || `kakao_${kakaoId}@kakao.onvoy`;
          const { data: { user: newUser } } = await supabaseAdmin.auth.admin.createUser({
            email: finalEmail,
            email_confirm: true,
            user_metadata: { full_name: kakaoNickname, avatar_url: kakaoAvatarUrl, kakao_id: kakaoId, provider: 'kakao' },
            app_metadata: { kakao_id: kakaoId, provider: 'kakao' }
          });
          userId = newUser!.id;
        }
      }
    }

    // 5. 세션 발급 (magiclink 타입으로 수정)
    let session = null;
    if (mode === 'login' && userId) {
      console.log("[DEBUG] Generating session via magiclink for:", finalEmail);
      const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink', // 'login' -> 'magiclink'로 정정
        email: finalEmail!,
      });
      if (linkErr) throw new Error(`Magiclink Generation Error: ${linkErr.message}`);

      const { data: otpData, error: otpErr } = await supabaseAdmin.auth.verifyOtp({
        email: finalEmail!,
        token: link.properties.email_otp,
        type: 'magiclink', // 'login' -> 'magiclink'로 정정
      });
      if (otpErr) throw new Error(`OTP Verification Error: ${otpErr.message}`);
      session = otpData.session;
    }

    // 6. Profiles 업데이트
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      nickname: kakaoNickname,
      avatar_url: kakaoAvatarUrl,
      kakao_id: kakaoId,
      updated_at: new Date().toISOString()
    });

    console.log("[DEBUG] --- SUCCESS ---");
    return new Response(JSON.stringify({
      access_token: session?.access_token,
      refresh_token: session?.refresh_token,
      expires_in: session?.expires_in,
      user: { id: userId, email: finalEmail, nickname: kakaoNickname, avatar_url: kakaoAvatarUrl }
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[DEBUG] CRITICAL ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
