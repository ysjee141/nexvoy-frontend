// Setup: https://supabase.com/docs/guides/functions/connect-to-supabase
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { JWT } from "npm:google-auth-library@9"

interface PushPayload {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
}

serve(async (req) => {
  try {
    const { tokens, title, body, data } = await req.json() as PushPayload

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens provided" }), { status: 400 })
    }

    const serviceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") || "{}")
    if (!serviceAccount.project_id) {
      return new Response(JSON.stringify({ error: "FCM_SERVICE_ACCOUNT secret missing" }), { status: 500 })
    }

    // Get OAuth2 access token for FCM
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    })
    const accessToken = await client.getAccessToken()

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
          )
          return { token, status: res.status, ok: res.ok }
        } catch (e) {
          return { token, error: e.message }
        }
      })
    )

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
