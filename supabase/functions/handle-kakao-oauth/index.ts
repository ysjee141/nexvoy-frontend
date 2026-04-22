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

    // ─── Step 4: 기존 이메일 계정 검색 및 계정 연결(Merge) / 신규 생성 ─
    let userId: string;

    // 4a. 카카오 provider_id로 이미 소셜 연결된 유저 확인
    const { data: existingIdentity } = await supabaseAdmin
      .from("auth.identities")
      .select("user_id")
      .eq("provider", "kakao")
      .eq("provider_id", kakaoId)
      .maybeSingle();

    if (existingIdentity?.user_id) {
      // 이미 카카오 연결된 유저
      userId = existingIdentity.user_id;
    } else if (kakaoEmail) {
      // 4b. 이메일로 기존 계정 검색
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const matchedUser = existingUsers?.users?.find(
        (u) => u.email === kakaoEmail
      );

      if (matchedUser) {
        // 계정 연결(Merge): 기존 계정에 카카오 identity 추가
        await supabaseAdmin.auth.admin.updateUserById(matchedUser.id, {
          app_metadata: {
            ...matchedUser.app_metadata,
            kakao_id: kakaoId,
          },
        });
        userId = matchedUser.id;
      } else {
        // 4c. 신규 유저 생성
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: kakaoEmail,
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
    } else {
      // 이메일 없는 카카오 계정: kakaoId를 email 대용으로 생성
      const syntheticEmail = `kakao_${kakaoId}@kakao.onvoy`;
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
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
        console.error("Create user (no-email) error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = newUser.user.id;
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
