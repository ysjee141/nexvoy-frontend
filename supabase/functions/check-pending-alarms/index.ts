const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalFunctionSecret = Deno.env.get('ONVOY_INTERNAL_FUNCTION_SECRET');

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  if (!isAuthorizedInternalRequest(req)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  console.info('[check-pending-alarms] Server alarm dispatch is disabled; mobile local notifications are authoritative.');
  return jsonResponse({
    status: 'disabled',
    reason: 'mobile_local_notifications_authoritative',
    processedCount: 0,
  }, 200);
});

function isAuthorizedInternalRequest(req: Request): boolean {
  const bearerToken = extractBearerToken(req.headers.get('Authorization'));
  if (bearerToken && supabaseServiceRoleKey && safeEqual(bearerToken, supabaseServiceRoleKey)) {
    return true;
  }

  const providedSecret = req.headers.get('x-onvoy-internal-secret');
  return Boolean(
    providedSecret &&
      internalFunctionSecret &&
      safeEqual(providedSecret, internalFunctionSecret),
  );
}

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
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
    headers: { 'Content-Type': 'application/json' },
  });
}
