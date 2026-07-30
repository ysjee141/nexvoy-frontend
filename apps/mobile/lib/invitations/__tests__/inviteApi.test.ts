import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getInviteApiErrorMessage,
  getInviteFunctionErrorMessage,
  isInviteApiSuccess,
  readInviteApiPayload,
} from '../inviteApi'

test('recognizes a valid invitation API response', () => {
  assert.equal(isInviteApiSuccess({
    invitation: {
      id: 'invite-1',
      role: 'editor',
      inviteCode: 'ABC123',
      expiresAt: null,
    },
    inviteUrl: 'https://preview.nexvoy.xyz/join?token=token',
  }), true)
})

test('formats a Vercel protected deployment response without object coercion', () => {
  const message = getInviteApiErrorMessage({
    protection: { vercel_auth_enabled: true },
    error: { code: '401', message: 'Protected deployment' },
  }, 401)

  assert.equal(message, '초대 서버에 연결할 수 없습니다. 앱의 API 환경 설정을 확인해 주세요.')
  assert.equal(message.includes('[object'), false)
})

test('preserves a string API error message', () => {
  assert.equal(
    getInviteApiErrorMessage({ error: '권한이 없습니다.' }, 403),
    '권한이 없습니다.',
  )
})

test('reads JSON and plain-text response payloads', async () => {
  const json = await readInviteApiPayload({
    ok: false,
    status: 400,
    text: async () => '{"error":"잘못된 요청입니다."}',
  })
  const text = await readInviteApiPayload({
    ok: false,
    status: 500,
    text: async () => 'temporary failure',
  })

  assert.deepEqual(json, { error: '잘못된 요청입니다.' })
  assert.equal(text, 'temporary failure')
})

test('reads the response body from a Supabase function error context', async () => {
  const message = await getInviteFunctionErrorMessage({
    message: 'Edge Function returned a non-2xx status code',
    context: {
      ok: false,
      status: 403,
      text: async () => '{"error":"권한이 없습니다."}',
    },
  })

  assert.equal(message, '권한이 없습니다.')
})
