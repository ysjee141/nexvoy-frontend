import { createClient } from 'npm:@supabase/supabase-js@2'
import { JWT } from 'npm:google-auth-library@9'

type NotificationEventType =
  | 'document_changed'
  | 'plan_changed'
  | 'checklist_changed'
  | 'member_joined'
  | 'member_removed'

interface PendingNotificationEvent {
  id: string
  document_id: string
  trip_id: string | null
  event_type: NotificationEventType
  title_key: string
  body_key: string
  metadata: Record<string, unknown>
  target_devices: TargetDevice[]
}

interface TargetDevice {
  user_id: string
  device_row_id: string
  device_id: string | null
  provider: 'fcm'
  fcm_token: string
}

interface DispatchResult {
  eventId: string
  status: 'delivered' | 'skipped' | 'failed'
  attemptedDeviceCount: number
  deliveredDeviceCount: number
  failureCode?: string
}

const DEFAULT_BATCH_LIMIT = 100

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const internalFunctionSecret = Deno.env.get('ONVOY_INTERNAL_FUNCTION_SECRET')

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[dispatch-notification-events] Supabase service env is missing.')
    return jsonResponse({ error: 'server_config_missing' }, 500)
  }

  if (!isAuthorizedInternalRequest(req)) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  try {
    const limit = await readLimit(req)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: events, error } = await supabase.rpc('list_pending_notification_events', {
      p_limit: limit,
    })
    if (error) {
      console.error('[dispatch-notification-events] Failed to list pending events.', {
        code: error.code,
      })
      return jsonResponse({ error: 'list_failed' }, 500)
    }

    const pendingEvents = normalizeEvents(events)
    const fcmClient = await createFcmClient()
    const results: DispatchResult[] = []

    for (const event of pendingEvents) {
      const result = await dispatchEvent(supabase, fcmClient, event)
      results.push(result)
    }

    return jsonResponse({
      processedCount: results.length,
      results,
    }, 200)
  } catch (error) {
    console.error('[dispatch-notification-events] Unhandled error.', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return jsonResponse({ error: 'dispatch_failed' }, 500)
  }
})

async function readLimit(req: Request): Promise<number> {
  try {
    const body = await req.json()
    if (isRecord(body) && Number.isFinite(body.limit)) {
      return clampLimit(Number(body.limit))
    }
  } catch {
    // Empty bodies are valid for cron-style invocations.
  }

  return DEFAULT_BATCH_LIMIT
}

function clampLimit(limit: number): number {
  return Math.min(500, Math.max(1, Math.floor(limit)))
}

async function createFcmClient(): Promise<{
  projectId: string
  accessToken: string
}> {
  const serviceAccountRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!serviceAccountRaw) {
    throw new Error('fcm_config_missing')
  }

  const serviceAccount = JSON.parse(serviceAccountRaw)
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('fcm_config_invalid')
  }

  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })

  const token = await client.getAccessToken()
  if (!token.token) {
    throw new Error('fcm_token_unavailable')
  }

  return {
    projectId: serviceAccount.project_id,
    accessToken: token.token,
  }
}

async function dispatchEvent(
  supabase: ReturnType<typeof createClient>,
  fcmClient: { projectId: string; accessToken: string },
  event: PendingNotificationEvent,
): Promise<DispatchResult> {
  const candidateDevices = event.target_devices.filter((device) => device.provider === 'fcm' && device.fcm_token)
  const acceptedUserIds = await fetchAcceptedTargetUsers(
    supabase,
    event.document_id,
    candidateDevices.map((device) => device.user_id),
  )
  const devices = candidateDevices.filter((device) => acceptedUserIds.has(device.user_id))

  if (devices.length === 0) {
    await supabase.rpc('mark_notification_event_skipped', {
      p_event_id: event.id,
      p_reason_code: candidateDevices.length > 0 ? 'target_not_accepted' : 'no_active_devices',
    })
    return {
      eventId: event.id,
      status: 'skipped',
      attemptedDeviceCount: 0,
      deliveredDeviceCount: 0,
      failureCode: candidateDevices.length > 0 ? 'target_not_accepted' : 'no_active_devices',
    }
  }

  const title = resolveTitle(event)
  const body = resolveBody(event)
  const data = buildNavigationData(event)
  let deliveredCount = 0
  let invalidatedCount = 0
  let failedCount = 0

  for (const device of devices) {
    const result = await sendFcm(fcmClient, {
      token: device.fcm_token,
      title,
      body,
      data,
    })

    if (result.ok) {
      deliveredCount += 1
      continue
    }

    failedCount += 1
    if (isInvalidTokenCode(result.code)) {
      invalidatedCount += 1
      await supabase
        .from('user_devices')
        .update({
          token_status: 'invalid',
          invalidated_at: new Date().toISOString(),
          invalidation_reason: result.code ?? 'fcm_invalid_token',
          updated_at: new Date().toISOString(),
        })
        .eq('id', device.device_row_id)
    }
  }

  if (deliveredCount > 0) {
    await supabase.rpc('mark_notification_event_delivered', {
      p_event_id: event.id,
      p_device_count: deliveredCount,
    })
    return {
      eventId: event.id,
      status: 'delivered',
      attemptedDeviceCount: devices.length,
      deliveredDeviceCount: deliveredCount,
      failureCode: failedCount > 0 ? 'partial_delivery' : undefined,
    }
  }

  await supabase.rpc('mark_notification_event_failed', {
    p_event_id: event.id,
    p_failure_code: invalidatedCount === devices.length ? 'all_tokens_invalid' : 'fcm_send_failed',
  })

  return {
    eventId: event.id,
    status: 'failed',
    attemptedDeviceCount: devices.length,
    deliveredDeviceCount: 0,
    failureCode: invalidatedCount === devices.length ? 'all_tokens_invalid' : 'fcm_send_failed',
  }
}

async function fetchAcceptedTargetUsers(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  userIds: string[],
): Promise<Set<string>> {
  const uniqueUserIds = [...new Set(userIds)].filter((userId) => userId.length > 0)
  if (uniqueUserIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('document_members')
    .select('user_id')
    .eq('document_id', documentId)
    .eq('status', 'accepted')
    .in('user_id', uniqueUserIds)

  if (error) {
    console.warn('[dispatch-notification-events] Accepted member recheck failed.', {
      code: error.code,
    })
    return new Set()
  }

  return new Set(
    (Array.isArray(data) ? data : [])
      .map((entry) => entry.user_id)
      .filter((userId): userId is string => typeof userId === 'string'),
  )
}

async function sendFcm(
  fcmClient: { projectId: string; accessToken: string },
  payload: {
    token: string
    title: string
    body: string
    data: Record<string, string>
  },
): Promise<{ ok: boolean; code?: string }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${fcmClient.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fcmClient.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: payload.token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data,
            android: {
              priority: 'high',
              notification: {
                channel_id: 'collaboration',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
          },
        }),
      },
    )

    if (response.ok) return { ok: true }

    const errorPayload = await safeJson(response)
    const code = extractFcmErrorCode(errorPayload) ?? `http_${response.status}`
    console.warn('[dispatch-notification-events] FCM send failed for redacted token.', { code })
    return { ok: false, code }
  } catch (error) {
    console.warn('[dispatch-notification-events] FCM request errored for redacted token.', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return { ok: false, code: 'request_error' }
  }
}

function resolveTitle(event: PendingNotificationEvent): string {
  switch (event.title_key) {
    case 'notification.collaboration.plan_changed.title':
      return '일정 업데이트'
    case 'notification.collaboration.checklist_changed.title':
      return '준비물 업데이트'
    case 'notification.collaboration.member_joined.title':
      return '동행자 업데이트'
    case 'notification.collaboration.member_removed.title':
      return '동행자 변경'
    default:
      return '여정 업데이트'
  }
}

function resolveBody(event: PendingNotificationEvent): string {
  const changeCount = readPositiveInteger(event.metadata.change_count)
  const suffix = changeCount > 1 ? ` (${changeCount}개 변경)` : ''

  switch (event.body_key) {
    case 'notification.collaboration.plan_changed.body':
      return `공유 여정의 일정이 변경되었습니다.${suffix}`
    case 'notification.collaboration.checklist_changed.body':
      return `공유 여정의 준비물이 변경되었습니다.${suffix}`
    case 'notification.collaboration.member_joined.body':
      return '공유 여정에 동행자가 참여했습니다.'
    case 'notification.collaboration.member_removed.body':
      return '공유 여정의 동행자 권한이 변경되었습니다.'
    default:
      return `공유 여정에 변경 사항이 있습니다.${suffix}`
  }
}

function buildNavigationData(event: PendingNotificationEvent): Record<string, string> {
  const data: Record<string, string> = {
    type: 'collaboration',
    event_type: event.event_type,
    document_id: event.document_id,
  }

  if (event.trip_id) {
    data.trip_id = event.trip_id
  }

  return data
}

function normalizeEvents(input: unknown): PendingNotificationEvent[] {
  if (!Array.isArray(input)) return []

  return input
    .map((entry) => {
      if (!isRecord(entry)) return null
      if (
        typeof entry.id !== 'string' ||
        typeof entry.document_id !== 'string' ||
        typeof entry.event_type !== 'string' ||
        typeof entry.title_key !== 'string' ||
        typeof entry.body_key !== 'string'
      ) {
        return null
      }

      return {
        id: entry.id,
        document_id: entry.document_id,
        trip_id: typeof entry.trip_id === 'string' ? entry.trip_id : null,
        event_type: entry.event_type as NotificationEventType,
        title_key: entry.title_key,
        body_key: entry.body_key,
        metadata: isRecord(entry.metadata) ? entry.metadata : {},
        target_devices: normalizeTargetDevices(entry.target_devices),
      }
    })
    .filter((entry): entry is PendingNotificationEvent => entry !== null)
}

function normalizeTargetDevices(input: unknown): TargetDevice[] {
  if (!Array.isArray(input)) return []

  return input
    .map((entry) => {
      if (!isRecord(entry)) return null
      if (
        typeof entry.user_id !== 'string' ||
        typeof entry.device_row_id !== 'string' ||
        entry.provider !== 'fcm' ||
        typeof entry.fcm_token !== 'string'
      ) {
        return null
      }

      return {
        user_id: entry.user_id,
        device_row_id: entry.device_row_id,
        device_id: typeof entry.device_id === 'string' ? entry.device_id : null,
        provider: 'fcm',
        fcm_token: entry.fcm_token,
      }
    })
    .filter((entry): entry is TargetDevice => entry !== null)
}

function readPositiveInteger(input: unknown): number {
  const value = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

function isInvalidTokenCode(code: string | undefined): boolean {
  return code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || code === 'SENDER_ID_MISMATCH'
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractFcmErrorCode(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined
  const error = input.error
  if (!isRecord(error)) return undefined
  return typeof error.status === 'string' ? error.status : undefined
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function isAuthorizedInternalRequest(req: Request): boolean {
  const bearerToken = extractBearerToken(req.headers.get('Authorization'))
  if (bearerToken && supabaseServiceRoleKey && safeEqual(bearerToken, supabaseServiceRoleKey)) {
    return true
  }

  const providedSecret = req.headers.get('x-onvoy-internal-secret')
  return Boolean(
    providedSecret &&
      internalFunctionSecret &&
      safeEqual(providedSecret, internalFunctionSecret),
  )
}

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
