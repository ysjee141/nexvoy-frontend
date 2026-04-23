import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "code and redirect_uri are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kakaoClientId = Deno.env.get("KAKAO_CLIENT_ID");
    const kakaoClientSecret = Deno.env.get("KAKAO_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!kakaoClientId || !kakaoClientSecret || !supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Step 1: 카카오 인가 코드 → Access Token 교환 ───────────────
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: kakaoClientId,
      client_secret: kakaoClientSecret,
      redirect_uri,
      code,
    });

    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Kakao token error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to exchange Kakao token", detail: errText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token: kakaoAccessToken } = await tokenRes.json();

    // ─── Step 2: 카카오 사용자 정보 조회 ────────────────────────────
    const userRes = await fetch(KAKAO_USER_URL, {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });

    if (!userRes.ok) {
      console.error("Kakao user info error");
      return new Response(
        JSON.stringify({ error: "Failed to fetch Kakao user info" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kakaoUser = await userRes.json();
    const kakaoId = String(kakaoUser.id);
    const kakaoEmail: string | null = kakaoUser.kakao_account?.email ?? null;
    const kakaoNickname: string | null =
      kakaoUser.kakao_account?.profile?.nickname ?? null;
    const kakaoAvatarUrl: string | null =
      kakaoUser.kakao_account?.profile?.profile_image_url ?? null;

    // ─── Step 3: Supabase Admin 클라이언트 초기화 ────────────────────
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── Step 4: 계정 연동(Linking) 또는 로그인/가입 처리 ─────────────
    let userId: string;

    // 4a. 현재 로그인된 유저가 있는지 확인 (연동 모드)
    if (authHeader) {
      const userRes = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
      const currentUser = userRes.data.user;

      if (currentUser) {
        // 이미 해당 카카오 계정이 다른 유저에게 연결되어 있는지 확인
        const { data: existingIdentity } = await supabaseAdmin
          .from("auth.identities")
          .select("user_id")
          .eq("provider", "kakao")
          .eq("provider_id", kakaoId)
          .maybeSingle();

        // app_metadata도 체크 (수동 매핑 방식 대비)
        const { data: usersWithKakao } = await supabaseAdmin.auth.admin.listUsers();
        const conflictUser = usersWithKakao?.users?.find(
          (u) => u.app_metadata?.kakao_id === kakaoId && u.id !== currentUser.id
        );

        if (existingIdentity?.user_id || conflictUser) {
          return new Response(
            JSON.stringify({ 
              error: "conflict", 
              message: "이미 다른 계정에 연동된 카카오 계정입니다." 
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // 현재 유저에 연동 (app_metadata 업데이트)
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(currentUser.id, {
          app_metadata: {
            ...currentUser.app_metadata,
            kakao_id: kakaoId,
            provider: currentUser.app_metadata.provider || 'email', // 기존 provider 유지 또는 email 설정
          },
          user_metadata: {
            ...currentUser.user_metadata,
            kakao_nickname: kakaoNickname,
            kakao_avatar_url: kakaoAvatarUrl,
          }
        });

        if (updateError) {
          console.error("Link account error:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to link account" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = currentUser.id;
      } else {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "로그인 세션이 만료되었습니다." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // 4b. 일반 로그인/가입 모드
      const { data: existingIdentity } = await supabaseAdmin
        .from("auth.identities")
        .select("user_id")
        .eq("provider", "kakao")
        .eq("provider_id", kakaoId)
        .maybeSingle();

      // app_metadata 기반 기존 유저 확인
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUserByMeta = allUsers?.users?.find(
        (u) => u.app_metadata?.kakao_id === kakaoId
      );

      if (existingIdentity?.user_id || existingUserByMeta) {
        userId = existingIdentity?.user_id || existingUserByMeta!.id;
      } else {
        // 동일 이메일 자동 병합은 정책상 제외함 (로그인 상태에서만 허용)
        // 신규 유저 생성
        const emailToUse = kakaoEmail || `kakao_${kakaoId}@kakao.onvoy`;
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: emailToUse,
            email_confirm: true,
            user_metadata: {
              full_name: kakaoNickname,
              avatar_url: kakaoAvatarUrl,
              kakao_id: kakaoId,
              provider: "kakao",
            },
            app_metadata: { provider: "kakao", kakao_id: kakaoId },
          });

        if (createError || !newUser.user) {
          console.error("Create user error:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = newUser.user.id;
      }
    }

    // ─── Step 5: 해당 유저의 Supabase 세션 발급 ─────────────────────
    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.admin.createSession(userId);

    if (sessionError || !sessionData?.session) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Step 6: profiles 테이블 upsert ─────────────────────────────
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        nickname: kakaoNickname,
        avatar_url: kakaoAvatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
        user: {
          id: userId,
          email: kakaoEmail,
          nickname: kakaoNickname,
          avatar_url: kakaoAvatarUrl,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
