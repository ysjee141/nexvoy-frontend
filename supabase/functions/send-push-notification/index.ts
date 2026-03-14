// Setup: https://supabase.com/docs/guides/functions/connect-to-supabase
import { JWT } from "npm:google-auth-library@9"

interface PushPayload {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    console.log("Received request body:", bodyText);

    let payload: PushPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
    }

    const { tokens, title, body, data } = payload;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      console.error("Validation Error: No tokens provided or not an array");
      return new Response(JSON.stringify({ message: "No tokens provided (array expected)" }), { status: 400 });
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
                  notification: { title, body },
                  data: data || {},
                  android: { priority: "high" },
                  apns: { payload: { aps: { sound: "default" } } },
                },
              }),
            }
          );
          
          const responseData = await res.json();
          if (!res.ok) {
            console.error(`FCM Error for token ${token.substring(0, 10)}...:`, responseData);
          }
          
          return { token: token.substring(0, 10) + "...", status: res.status, ok: res.ok, response: responseData };
        } catch (e) {
          console.error(`Fetch Error for token ${token.substring(0, 10)}...:`, e);
          return { token: token.substring(0, 10) + "...", error: e.message };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Global Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
