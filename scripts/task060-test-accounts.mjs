#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const DEV_PROJECT_REF = 'ivgkqzwosbjukonlpfdw'
const DEV_URL = `https://${DEV_PROJECT_REF}.supabase.co`
const root = process.cwd()
const envPath = process.env.TASK060_ENV_FILE
  ? path.resolve(root, process.env.TASK060_ENV_FILE)
  : path.join(root, 'apps/web/.env.test.local')
const credentialsPath = path.join(root, '_workspace/task060/credentials.json')
const accounts = [
  ['owner', 'ysjee141+task060-owner@gmail.com'],
  ['editor', 'ysjee141+task060-editor@gmail.com'],
  ['viewer', 'ysjee141+task060-viewer@gmail.com'],
  ['outsider', 'ysjee141+task060-outsider@gmail.com'],
  ['mismatch', 'ysjee141+task060-mismatch@gmail.com'],
]

function parseEnv(filePath) {
  if (!existsSync(filePath)) return {}
  const values = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return values
}

function requireValue(values, name) {
  const value = process.env[name]?.trim() || values[name]?.trim()
  if (!value) throw new Error(`환경변수 누락: ${name}`)
  return value
}

async function request(url, serviceKey, pathname, init = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = await response.text()
  const data = body ? JSON.parse(body) : null
  return { response, data }
}

async function findProfileUserId(url, serviceKey, email) {
  const query = new URLSearchParams({
    select: 'id',
    email: `eq.${email}`,
    limit: '1',
  })
  const { response, data } = await request(
    url,
    serviceKey,
    `/rest/v1/profiles?${query}`,
  )
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`DEV profile 조회 실패 (${response.status})`)
  }
  return typeof data[0]?.id === 'string' ? data[0].id : null
}

async function ensureProfile(url, serviceKey, id, email) {
  const { response } = await request(
    url,
    serviceKey,
    '/rest/v1/profiles?on_conflict=id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id, email }),
    },
  )
  if (!response.ok) throw new Error(`DEV profile 보장 실패 (${response.status})`)
}

async function removeUserAssets(url, serviceKey, userId) {
  const query = new URLSearchParams({
    select: 'object_path',
    user_id: `eq.${userId}`,
  })
  const { response, data } = await request(
    url,
    serviceKey,
    `/rest/v1/trip_asset_objects?${query}`,
  )
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`DEV 테스트 asset 조회 실패 (${response.status})`)
  }

  const objectPaths = data
    .map((row) => row?.object_path)
    .filter((objectPath) => typeof objectPath === 'string')
  if (objectPaths.length === 0) return

  const { response: removeResponse } = await request(
    url,
    serviceKey,
    '/storage/v1/object/place-photos',
    {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: objectPaths }),
    },
  )
  if (!removeResponse.ok) {
    throw new Error(`DEV 테스트 Storage 정리 실패 (${removeResponse.status})`)
  }
}

async function provision(url, serviceKey) {
  const password = `T60!${randomBytes(18).toString('base64url')}`

  for (const [role, email] of accounts) {
    const existingId = await findProfileUserId(url, serviceKey, email)
    const pathname = existingId
      ? `/auth/v1/admin/users/${existingId}`
      : '/auth/v1/admin/users'
    const { response, data } = await request(url, serviceKey, pathname, {
      method: existingId ? 'PUT' : 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: `TASK-060 ${role}` },
      }),
    })
    if (!response.ok || typeof data?.id !== 'string') {
      throw new Error(`DEV ${role} 계정 준비 실패 (${response.status})`)
    }
    await ensureProfile(url, serviceKey, data.id, email)
  }

  mkdirSync(path.dirname(credentialsPath), { recursive: true })
  writeFileSync(
    credentialsPath,
    `${JSON.stringify({
      task: 'TASK-060',
      projectRef: DEV_PROJECT_REF,
      issuedAt: new Date().toISOString(),
      accounts: Object.fromEntries(
        accounts.map(([role, email]) => [role, { email, password }]),
      ),
    }, null, 2)}\n`,
    { mode: 0o600 },
  )
  chmodSync(credentialsPath, 0o600)
  process.stdout.write(`${credentialsPath}\n`)
}

async function remove(url, serviceKey) {
  let removed = 0
  for (const [, email] of accounts) {
    const userId = await findProfileUserId(url, serviceKey, email)
    if (!userId) continue
    await removeUserAssets(url, serviceKey, userId)
    const { response } = await request(
      url,
      serviceKey,
      `/auth/v1/admin/users/${userId}`,
      { method: 'DELETE' },
    )
    if (!response.ok) throw new Error(`DEV 테스트 계정 삭제 실패 (${response.status})`)
    removed += 1
  }
  rmSync(credentialsPath, { force: true })
  process.stdout.write(`removed=${removed}\n`)
}

async function main() {
  if (process.env.TASK060_ALLOW_DEV_ACCOUNT_ADMIN !== 'yes') {
    throw new Error(
      'TASK060_ALLOW_DEV_ACCOUNT_ADMIN=yes가 아니므로 계정 작업을 중단합니다.',
    )
  }
  const values = parseEnv(envPath)
  const url = requireValue(values, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')
  if (url !== DEV_URL) {
    throw new Error(`TASK-060 계정 작업은 DEV ${DEV_PROJECT_REF}에서만 허용됩니다.`)
  }
  const serviceKey = requireValue(values, 'SUPABASE_SERVICE_ROLE_KEY')
  if (process.argv.includes('--delete')) {
    await remove(url, serviceKey)
    return
  }
  await provision(url, serviceKey)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
