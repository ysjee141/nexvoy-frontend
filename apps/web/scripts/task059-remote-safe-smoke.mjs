#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const DEV_PROJECT_REF = 'ivgkqzwosbjukonlpfdw'
const DEV_URL = `https://${DEV_PROJECT_REF}.supabase.co`

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`환경변수 누락: ${name}`)
  return value
}

function assertRemoteSafety() {
  if (requireEnv('TASK059_ALLOW_DEV_SMOKE') !== 'yes') {
    throw new Error('TASK059_ALLOW_DEV_SMOKE=yes가 아니므로 DEV 스모크를 중단합니다.')
  }
  const url = requireEnv('TASK059_DEV_SUPABASE_URL').replace(/\/$/, '')
  if (url !== DEV_URL) {
    throw new Error(`TASK-059 스모크는 DEV ${DEV_PROJECT_REF}에서만 실행할 수 있습니다.`)
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('service role 환경변수가 설정된 상태에서는 실행하지 않습니다.')
  }
  return url
}

function getQaCredentials(role) {
  const prefix = `TASK059_QA_${role.toUpperCase()}`
  const email = requireEnv(`${prefix}_EMAIL`).toLowerCase()
  if (!email.includes('task059')) {
    throw new Error(`${prefix}_EMAIL은 TASK-059 전용 계정이어야 합니다.`)
  }
  return { email, password: requireEnv(`${prefix}_PASSWORD`) }
}

async function signIn(url, anonKey, credentials) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword(credentials)
  if (error || !data.user || !data.session) {
    throw new Error(`QA 계정 로그인 실패: ${credentials.email}: ${error?.message ?? '세션 없음'}`)
  }
  return { client, user: data.user }
}

async function rpc(client, name, parameters) {
  const { data, error } = await client.rpc(name, parameters)
  if (error) throw new Error(`${name} 실패 [${error.code ?? 'unknown'}]: ${error.message}`)
  return data
}

async function expectRpcDenied(label, client, name, parameters) {
  const { error } = await client.rpc(name, parameters)
  if (!error) throw new Error(`${label}: 호출이 허용되었습니다.`)
  if (
    error.code !== '42501' &&
    !/permission|forbidden|not_authenticated|schema cache|could not find/i.test(error.message)
  ) {
    throw new Error(`${label}: 예상하지 못한 오류 [${error.code ?? 'unknown'}]: ${error.message}`)
  }
}

function dateOffset(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function tripCommand(tripId, ownerId, runId) {
  return {
    operation_id: randomUUID(),
    entity_type: 'trip',
    entity_id: tripId,
    action: 'upsert',
    payload: {
      user_id: ownerId,
      destination: `TASK-059 DEV SMOKE ${runId}`,
      start_date: dateOffset(30),
      end_date: dateOffset(31),
      adults_count: 1,
      children_count: 0,
    },
    created_at: new Date().toISOString(),
  }
}

async function createTargetedInvitation(owner, tripId, role, email) {
  const result = await rpc(owner, 'create_document_invitation_link', {
    p_document_id: tripId,
    p_role: role,
    p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    p_max_uses: 1,
    p_target_email: email,
    p_destination: 'TASK-059 DEV 스모크',
    p_start_date: dateOffset(30),
    p_end_date: dateOffset(31),
  })
  if (!result || typeof result.token !== 'string') {
    throw new Error('create_document_invitation_link 응답에 token이 없습니다.')
  }
  return result.token
}

async function getRevision(client, tripId) {
  const revision = await rpc(client, 'get_trip_authority_revision', {
    p_trip_id: tripId,
  })
  if (!Number.isSafeInteger(Number(revision))) {
    throw new Error(`유효하지 않은 revision: ${String(revision)}`)
  }
  return Number(revision)
}

async function applyPlan(client, tripId, runId) {
  const revision = await getRevision(client, tripId)
  const command = {
    operation_id: randomUUID(),
    entity_type: 'plan',
    entity_id: randomUUID(),
    action: 'upsert',
    payload: {
      title: `TASK-059 editor plan ${runId}`,
      location: 'DEV QA',
      start_datetime_local: `${dateOffset(30)}T10:00:00`,
      end_datetime_local: `${dateOffset(30)}T11:00:00`,
      timezone_string: 'Asia/Seoul',
    },
    created_at: new Date().toISOString(),
  }
  const first = await rpc(client, 'apply_trip_commands', {
    p_trip_id: tripId,
    p_commands: [command],
    p_base_revision: revision,
  })
  if (first?.status !== 'applied') {
    throw new Error(`editor command 상태가 applied가 아닙니다: ${JSON.stringify(first)}`)
  }
  const duplicate = await rpc(client, 'apply_trip_commands', {
    p_trip_id: tripId,
    p_commands: [command],
    p_base_revision: revision,
  })
  if (duplicate?.status !== 'duplicate' || duplicate.revision !== first.revision) {
    throw new Error(`멱등 재실행 결과가 올바르지 않습니다: ${JSON.stringify(duplicate)}`)
  }
  return { revisionBefore: revision, revisionAfter: Number(first.revision) }
}

async function findMember(owner, tripId, email) {
  const rows = await rpc(owner, 'list_document_collaborators', {
    p_document_id: tripId,
  })
  const member = Array.isArray(rows)
    ? rows.find((row) => String(row.email).toLowerCase() === email)
    : null
  if (!member || typeof member.member_id !== 'string') {
    throw new Error(`accepted collaborator를 찾지 못했습니다: ${email}`)
  }
  return member
}

async function bestEffortCleanup(owner, tripId, memberIds) {
  for (const memberId of memberIds) {
    try {
      await rpc(owner, 'revoke_document_member', { p_member_id: memberId })
    } catch {
      // A member already revoked by the test needs no further cleanup.
    }
  }
  try {
    const revision = await getRevision(owner, tripId)
    await rpc(owner, 'apply_trip_commands', {
      p_trip_id: tripId,
      p_commands: [{
        operation_id: randomUUID(),
        entity_type: 'trip',
        entity_id: tripId,
        action: 'delete',
        created_at: new Date().toISOString(),
      }],
      p_base_revision: revision,
    })
  } catch {
    // Preserve the original test failure; the report records cleanup status.
    return false
  }
  return true
}

async function main() {
  const startedAt = new Date()
  const url = assertRemoteSafety()
  const anonKey = requireEnv('TASK059_DEV_SUPABASE_ANON_KEY')
  const credentials = {
    owner: getQaCredentials('owner'),
    editor: getQaCredentials('editor'),
    viewer: getQaCredentials('viewer'),
    outsider: getQaCredentials('outsider'),
  }
  const signedIn = Object.fromEntries(
    await Promise.all(
      Object.entries(credentials).map(async ([role, value]) => [
        role,
        await signIn(url, anonKey, value),
      ]),
    ),
  )
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const tripId = randomUUID()
  const runId = startedAt.toISOString().replace(/\D/g, '').slice(0, 14)
  const cleanupMemberIds = []
  let cleanupPassed = false

  try {
    const createResult = await rpc(signedIn.owner.client, 'apply_trip_commands', {
      p_trip_id: tripId,
      p_commands: [tripCommand(tripId, signedIn.owner.user.id, runId)],
      p_base_revision: 0,
    })
    if (createResult?.status !== 'applied') {
      throw new Error(`여행 생성 결과가 applied가 아닙니다: ${JSON.stringify(createResult)}`)
    }

    const editorToken = await createTargetedInvitation(
      signedIn.owner.client,
      tripId,
      'editor',
      credentials.editor.email,
    )
    const viewerToken = await createTargetedInvitation(
      signedIn.owner.client,
      tripId,
      'viewer',
      credentials.viewer.email,
    )
    await rpc(signedIn.editor.client, 'accept_document_invitation', {
      p_token: editorToken,
      p_invite_code: null,
    })
    await rpc(signedIn.viewer.client, 'accept_document_invitation', {
      p_token: viewerToken,
      p_invite_code: null,
    })

    const editorMember = await findMember(
      signedIn.owner.client,
      tripId,
      credentials.editor.email,
    )
    const viewerMember = await findMember(
      signedIn.owner.client,
      tripId,
      credentials.viewer.email,
    )
    cleanupMemberIds.push(editorMember.member_id, viewerMember.member_id)

    const revisionCheck = await applyPlan(signedIn.editor.client, tripId, runId)
    if (revisionCheck.revisionAfter !== revisionCheck.revisionBefore + 1) {
      throw new Error(`revision이 정확히 1 증가하지 않았습니다: ${JSON.stringify(revisionCheck)}`)
    }

    await rpc(signedIn.viewer.client, 'get_trip_authority_bundle', {
      p_trip_id: tripId,
    })
    await expectRpcDenied(
      'viewer write',
      signedIn.viewer.client,
      'apply_trip_commands',
      {
        p_trip_id: tripId,
        p_commands: [{
          operation_id: randomUUID(),
          entity_type: 'trip',
          entity_id: tripId,
          action: 'delete',
          created_at: new Date().toISOString(),
        }],
        p_base_revision: await getRevision(signedIn.viewer.client, tripId),
      },
    )
    await expectRpcDenied(
      'outsider read',
      signedIn.outsider.client,
      'get_trip_authority_bundle',
      { p_trip_id: tripId },
    )
    await expectRpcDenied(
      'anon public write wrapper',
      anon,
      'apply_trip_commands',
      { p_trip_id: tripId, p_commands: [], p_base_revision: 0 },
    )
    await expectRpcDenied(
      'anon internal command function',
      anon,
      'apply_one_trip_authority_command',
      {
        p_trip_id: tripId,
        p_command: tripCommand(tripId, signedIn.owner.user.id, runId),
        p_actor_id: signedIn.owner.user.id,
      },
    )

    await rpc(signedIn.owner.client, 'set_document_member_role', {
      p_member_id: editorMember.member_id,
      p_role: 'viewer',
    })
    await expectRpcDenied(
      'downgraded editor write',
      signedIn.editor.client,
      'apply_trip_commands',
      {
        p_trip_id: tripId,
        p_commands: [{
          operation_id: randomUUID(),
          entity_type: 'trip',
          entity_id: tripId,
          action: 'delete',
          created_at: new Date().toISOString(),
        }],
        p_base_revision: await getRevision(signedIn.editor.client, tripId),
      },
    )
    await rpc(signedIn.owner.client, 'revoke_document_member', {
      p_member_id: editorMember.member_id,
    })
    await expectRpcDenied(
      'revoked editor read',
      signedIn.editor.client,
      'get_trip_authority_bundle',
      { p_trip_id: tripId },
    )

    cleanupPassed = await bestEffortCleanup(
      signedIn.owner.client,
      tripId,
      cleanupMemberIds,
    )
    const report = {
      task: 'TASK-059',
      projectRef: DEV_PROJECT_REF,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      tripId,
      status: cleanupPassed ? 'PASS' : 'PASS_WITH_CLEANUP_FAILURE',
      checks: [
        'owner trip bootstrap',
        'targeted editor/viewer invitation acceptance',
        'editor mutation and duplicate operation idempotency',
        'viewer read and write denial',
        'outsider read denial',
        'anonymous wrapper/internal denial',
        'editor downgrade and revoke propagation',
        'revision increment',
      ],
      cleanup: cleanupPassed ? 'soft_deleted' : 'failed',
    }
    if (process.env.TASK059_SMOKE_REPORT) {
      await writeFile(process.env.TASK059_SMOKE_REPORT, `${JSON.stringify(report, null, 2)}\n`)
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!cleanupPassed) process.exitCode = 1
  } catch (error) {
    cleanupPassed = await bestEffortCleanup(
      signedIn.owner.client,
      tripId,
      cleanupMemberIds,
    )
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${reason} (cleanup=${cleanupPassed ? 'soft_deleted' : 'failed'})`)
  } finally {
    await Promise.all(
      Object.values(signedIn).map(({ client }) => client.auth.signOut()),
    )
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
