// Setup: https://supabase.com/docs/guides/functions/connect-to-supabase
import { JWT } from "npm:google-auth-library@9"

interface PushPayload {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
}

const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const internalFunctionSecret = Deno.env.get("ONVOY_INTERNAL_FUNCTION_SECRET");
const LEGACY_TITLE_ALLOWLIST = new Set([
  "새로운 여행 초대!",
  "새로운 일정이 추가되었습니다!",
  "새로운 동행자 참여!",
  "일정 알림 ⏰",
]);
const LEGACY_BODY_BY_TITLE: Record<string, string> = {
  "새로운 여행 초대!": "OnVoy에서 공유 여행 초대를 확인해 주세요.",
  "새로운 일정이 추가되었습니다!": "공유 여행에 새 변경 사항이 있어요.",
  "새로운 동행자 참여!": "공유 여행의 동행자 목록이 업데이트됐어요.",
  "일정 알림 ⏰": "모바일 앱에서 설정한 일정 알림을 확인해 주세요.",
};
const LEGACY_DATA_KEYS = new Set(["type", "tripId", "planId"]);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    if (!isAuthorizedInternalRequest(req)) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    let payload: PushPayload;
    try {
      payload = await req.json();
    } catch (e) {
      console.error("JSON Parse Error:", errorName(e));
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
    }

    const { tokens, title, body, data } = payload;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0 || tokens.some((token) => typeof token !== "string" || token.length === 0)) {
      console.error("Validation Error: No tokens provided or not an array");
      return new Response(JSON.stringify({ message: "No tokens provided (array expected)" }), { status: 400 });
    }

    const safePayload = normalizeLegacyPayload({ title, body, data });
    if (!safePayload) {
      console.warn("Validation Error: Rejected non-legacy push payload");
      return jsonResponse({ error: "unsupported_push_payload" }, 400);
    }

    const serviceAccountRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) {
      console.error("Config Error: FCM_SERVICE_ACCOUNT secret is missing");
      return new Response(JSON.stringify({ error: "FCM_SERVICE_ACCOUNT secret missing" }), { status: 500 });
    }

    const serviceAccount = JSON.parse(serviceAccountRaw);
    if (!serviceAccount.project_id) {
      console.error("Config Error: Invalid service account JSON (missing project_id)");
      return new Response(JSON.stringify({ error: "Invalid FCM_SERVICE_ACCOUNT config" }), { status: 500 });
    }

    console.log(`Preparing to send notification to ${tokens.length} devices...`);

    // Get OAuth2 access token for FCM
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    
    const accessToken = await client.getAccessToken();

    const results = await Promise.all(
      tokens.map(async (token) => {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken.token}`,
              },
              body: JSON.stringify({
                message: {
                  token: token,
                  notification: {
                    title: safePayload.title,
                    body: safePayload.body,
                  },
                  data: safePayload.data,
                  android: { priority: "high" },
                  apns: { payload: { aps: { sound: "default" } } },
                },
              }),
            }
          );
          
          const responseData = await safeJson(res);
          if (!res.ok) {
            console.error("FCM Error for redacted token:", {
              status: res.status,
              code: extractFcmErrorCode(responseData),
            });
          }
          
          return {
            token: "redacted",
            status: res.status,
            ok: res.ok,
            code: extractFcmErrorCode(responseData),
          };
        } catch (e) {
          console.error("Fetch Error for redacted token:", { errorName: errorName(e) });
          return { token: "redacted", error: "send_failed" };
        }
      })
    );

    return jsonResponse({ results }, 200);

  } catch (error) {
    console.error("Global Edge Function Error:", { errorName: errorName(error) });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
})

function normalizeLegacyPayload(payload: {
  title: unknown
  body: unknown
  data: unknown
}): PushPayload | null {
  if (
    typeof payload.title !== "string" ||
    !LEGACY_TITLE_ALLOWLIST.has(payload.title)
  ) {
    return null;
  }

  const data = sanitizeLegacyData(payload.data);
  if (!data) return null;

  return {
    tokens: [],
    title: payload.title,
    body: LEGACY_BODY_BY_TITLE[payload.title],
    data,
  };
}

function sanitizeLegacyData(input: unknown): Record<string, string> | null {
  if (input === undefined) return {};
  if (!isRecord(input)) return null;

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!LEGACY_DATA_KEYS.has(key) || typeof value !== "string") return null;
    if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(value)) return null;
    output[key] = value;
  }

  return output;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractFcmErrorCode(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  const error = input.error;
  if (!isRecord(error)) return undefined;
  return typeof error.status === "string" ? error.status : undefined;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function isAuthorizedInternalRequest(req: Request): boolean {
  const bearerToken = extractBearerToken(req.headers.get("Authorization"));
  if (bearerToken && supabaseServiceRoleKey && safeEqual(bearerToken, supabaseServiceRoleKey)) {
    return true;
  }

  const providedSecret = req.headers.get("x-onvoy-internal-secret");
  return Boolean(
    providedSecret &&
      internalFunctionSecret &&
      safeEqual(providedSecret, internalFunctionSecret),
  );
}

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
