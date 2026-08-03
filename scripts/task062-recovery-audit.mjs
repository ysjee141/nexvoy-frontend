#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEV_PROJECT_REF = 'ivgkqzwosbjukonlpfdw'
export const PRODUCTION_PROJECT_REF = 'runbcaegpefqnljsswhv'

const TABLES = [
  ['trips', 'id'],
  ['plans', 'id'],
  ['checklists', 'id'],
  ['checklist_items', 'id'],
  ['checklist_templates', 'id'],
  ['checklist_template_items', 'id'],
  ['document_members', 'id'],
  ['trip_authority_state', 'trip_id'],
  ['template_authority_state', 'template_id'],
  ['applied_operations', 'operation_id'],
  ['trip_asset_objects', 'id'],
]
const REQUIRED_BACKUP_FILES = [
  'schema.sql',
  'data.sql',
  'roles.sql',
  'place-photos.manifest',
]

function parseArguments(argv) {
  const [command, ...rest] = argv
  if (!command || !['preflight', 'backup-manifest', 'capture', 'compare'].includes(command)) {
    throw new Error('사용법: task062-recovery-audit.mjs <preflight|backup-manifest|capture|compare> [options]')
  }
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (!argument.startsWith('--')) throw new Error(`알 수 없는 인자: ${argument}`)
    const value = rest[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${argument} 값이 필요합니다.`)
    options[argument.slice(2)] = value
    index += 1
  }
  return { command, options }
}

function requireOption(options, name) {
  const value = options[name]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`--${name} 값이 필요합니다.`)
  return value.trim()
}

function assertReleaseSha(value) {
  if (!/^[a-f0-9]{7,40}$/i.test(value)) throw new Error('release SHA는 7~40자리 hex여야 합니다.')
}

function assertProjectRef(value, label) {
  if (!/^[a-z0-9]{20}$/.test(value)) throw new Error(`${label} project ref 형식이 잘못되었습니다.`)
}

export function validateProjectRefs(sourceRef, recoveryRef) {
  assertProjectRef(sourceRef, 'source')
  assertProjectRef(recoveryRef, 'recovery')
  if (sourceRef !== DEV_PROJECT_REF) {
    throw new Error(`TASK-062 source는 DEV ${DEV_PROJECT_REF}만 허용합니다.`)
  }
  if (recoveryRef === sourceRef) throw new Error('Recovery project는 source와 달라야 합니다.')
  if (recoveryRef === PRODUCTION_PROJECT_REF) {
    throw new Error('Production project를 Recovery 대상으로 사용할 수 없습니다.')
  }
  return { sourceRef, recoveryRef }
}

export function validateLinkedProjectRef(linkedRef, sourceRef) {
  if (linkedRef !== sourceRef) {
    throw new Error(`Supabase CLI linked ref가 source ${sourceRef}와 다릅니다.`)
  }
  return linkedRef
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  )
}

function canonicalDigest(values) {
  const rows = values.map((value) => JSON.stringify(canonicalize(value))).sort()
  return sha256(rows.join('\n'))
}

function walkFiles(directory, root = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walkFiles(absolutePath, root)
    if (!entry.isFile()) return []
    return [{
      absolutePath,
      relativePath: path.relative(root, absolutePath).split(path.sep).join('/'),
    }]
  })
}

export function buildBackupManifest({
  backupDir,
  sourceRef,
  recoveryRef,
  releaseSha,
  outputPath = path.join(backupDir, 'task062-backup-manifest.json'),
}) {
  validateProjectRefs(sourceRef, recoveryRef)
  assertReleaseSha(releaseSha)
  if (!existsSync(backupDir) || !statSync(backupDir).isDirectory()) {
    throw new Error(`backup directory가 없습니다: ${backupDir}`)
  }
  const missing = REQUIRED_BACKUP_FILES.filter((name) => !existsSync(path.join(backupDir, name)))
  if (missing.length > 0) throw new Error(`필수 backup 파일 누락: ${missing.join(', ')}`)
  const normalizedOutput = path.resolve(outputPath)
  const files = walkFiles(backupDir)
    .filter(({ absolutePath }) => path.resolve(absolutePath) !== normalizedOutput)
    .map(({ absolutePath, relativePath }) => {
      const bytes = readFileSync(absolutePath)
      return { path: relativePath, size: bytes.length, sha256: sha256(bytes) }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
  const manifest = {
    task: 'TASK-062',
    generatedAt: new Date().toISOString(),
    sourceRef,
    recoveryRef,
    releaseSha,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    files,
  }
  writeJson(outputPath, manifest)
  return manifest
}

async function requestJson(url, serviceRoleKey, pathname, init = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Supabase evidence 요청 실패 (${response.status})`)
  return text ? JSON.parse(text) : null
}

async function fetchTableRows(url, serviceRoleKey, table, orderColumn) {
  const rows = []
  const pageSize = 1_000
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: '*',
      order: `${orderColumn}.asc`,
      limit: String(pageSize),
      offset: String(offset),
    })
    const page = await requestJson(url, serviceRoleKey, `/rest/v1/${table}?${query}`)
    if (!Array.isArray(page)) throw new Error(`${table} 응답 형식이 잘못되었습니다.`)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

async function listStorageObjects(url, serviceRoleKey, prefix = '', visited = new Set()) {
  if (visited.has(prefix)) throw new Error('Storage prefix 순환을 감지했습니다.')
  visited.add(prefix)
  const descriptors = []
  const pageSize = 1_000
  for (let offset = 0; ; offset += pageSize) {
    const page = await requestJson(url, serviceRoleKey, '/storage/v1/object/list/place-photos', {
      method: 'POST',
      body: JSON.stringify({
        prefix,
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    })
    if (!Array.isArray(page)) throw new Error('Storage 목록 응답 형식이 잘못되었습니다.')
    for (const entry of page) {
      const name = typeof entry?.name === 'string' ? entry.name : ''
      if (!name) continue
      const objectPath = prefix ? `${prefix}/${name}` : name
      if (entry.id == null && entry.metadata == null) {
        descriptors.push(...await listStorageObjects(url, serviceRoleKey, objectPath, visited))
        continue
      }
      descriptors.push({
        path: objectPath,
        size: Number(entry.metadata?.size ?? 0),
        etag: String(entry.metadata?.eTag ?? entry.metadata?.etag ?? ''),
      })
    }
    if (page.length < pageSize) return descriptors
  }
}

export async function captureIntegritySnapshot({
  projectRef,
  sourceRef,
  recoveryRef,
  role,
  releaseSha,
  url,
  serviceRoleKey,
}) {
  validateProjectRefs(sourceRef, recoveryRef)
  assertReleaseSha(releaseSha)
  const expectedRef = role === 'source' ? sourceRef : role === 'recovery' ? recoveryRef : null
  if (!expectedRef) throw new Error('--role은 source 또는 recovery여야 합니다.')
  if (projectRef !== expectedRef) throw new Error(`${role} project ref가 preflight 값과 다릅니다.`)
  if (!url) throw new Error('TASK062_SUPABASE_URL이 필요합니다.')
  if (!serviceRoleKey) throw new Error('TASK062_SERVICE_ROLE_KEY가 필요합니다.')
  const normalizedUrl = url.replace(/\/$/, '')
  if (new URL(normalizedUrl).host !== `${projectRef}.supabase.co`) {
    throw new Error('TASK062_SUPABASE_URL과 project ref가 일치하지 않습니다.')
  }

  const tables = {}
  for (const [table, orderColumn] of TABLES) {
    const rows = await fetchTableRows(normalizedUrl, serviceRoleKey, table, orderColumn)
    tables[table] = { count: rows.length, digest: canonicalDigest(rows) }
  }
  const storageObjects = await listStorageObjects(normalizedUrl, serviceRoleKey)
  return {
    task: 'TASK-062',
    role,
    projectRef,
    releaseSha,
    capturedAt: new Date().toISOString(),
    tables,
    storage: {
      bucket: 'place-photos',
      objectCount: storageObjects.length,
      digest: canonicalDigest(storageObjects),
    },
  }
}

export function compareSnapshots(source, recovery) {
  const errors = []
  if (source.task !== 'TASK-062' || source.role !== 'source') errors.push('source snapshot 형식 오류')
  if (recovery.task !== 'TASK-062' || recovery.role !== 'recovery') errors.push('recovery snapshot 형식 오류')
  try {
    validateProjectRefs(source.projectRef, recovery.projectRef)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
  if (source.releaseSha !== recovery.releaseSha) errors.push('source/recovery release SHA 불일치')
  const tables = {}
  for (const [table] of TABLES) {
    const expected = source.tables?.[table]
    const actual = recovery.tables?.[table]
    const match = Boolean(expected && actual)
      && expected.count === actual.count
      && expected.digest === actual.digest
    tables[table] = { match, source: expected ?? null, recovery: actual ?? null }
    if (!match) errors.push(`${table} count 또는 digest 불일치`)
  }
  const storageMatch = source.storage?.bucket === 'place-photos'
    && recovery.storage?.bucket === 'place-photos'
    && source.storage?.objectCount === recovery.storage?.objectCount
    && source.storage?.digest === recovery.storage?.digest
  if (!storageMatch) errors.push('place-photos object count 또는 digest 불일치')
  return {
    task: 'TASK-062',
    generatedAt: new Date().toISOString(),
    releaseSha: source.releaseSha ?? null,
    sourceRef: source.projectRef ?? null,
    recoveryRef: recovery.projectRef ?? null,
    status: errors.length === 0 ? 'GO' : 'NO-GO',
    tables,
    storage: {
      match: storageMatch,
      source: source.storage ?? null,
      recovery: recovery.storage ?? null,
    },
    errors,
  }
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2))
  const sourceRef = requireOption(options, 'source-ref')
  const recoveryRef = requireOption(options, 'recovery-ref')
  validateProjectRefs(sourceRef, recoveryRef)
  if (command === 'preflight') {
    const linkedRefPath = path.resolve(
      typeof options['linked-ref-file'] === 'string'
        ? options['linked-ref-file']
        : 'supabase/.temp/project-ref',
    )
    if (!existsSync(linkedRefPath)) {
      throw new Error(`Supabase CLI linked ref 파일이 없습니다: ${linkedRefPath}`)
    }
    const linkedRef = validateLinkedProjectRef(readFileSync(linkedRefPath, 'utf8').trim(), sourceRef)
    process.stdout.write(`${JSON.stringify({ status: 'PASS', sourceRef, recoveryRef, linkedRef })}\n`)
    return
  }
  if (command === 'backup-manifest') {
    const manifest = buildBackupManifest({
      backupDir: path.resolve(requireOption(options, 'backup-dir')),
      sourceRef,
      recoveryRef,
      releaseSha: requireOption(options, 'release-sha'),
      outputPath: typeof options.output === 'string' ? path.resolve(options.output) : undefined,
    })
    process.stdout.write(`${JSON.stringify({ status: 'PASS', fileCount: manifest.fileCount })}\n`)
    return
  }
  if (command === 'capture') {
    const role = requireOption(options, 'role')
    const projectRef = requireOption(options, 'project-ref')
    const snapshot = await captureIntegritySnapshot({
      projectRef,
      sourceRef,
      recoveryRef,
      role,
      releaseSha: requireOption(options, 'release-sha'),
      url: process.env.TASK062_SUPABASE_URL ?? '',
      serviceRoleKey: process.env.TASK062_SERVICE_ROLE_KEY ?? '',
    })
    writeJson(path.resolve(requireOption(options, 'output')), snapshot)
    process.stdout.write(`${JSON.stringify({ status: 'PASS', role })}\n`)
    return
  }
  const source = readJson(path.resolve(requireOption(options, 'source')))
  const recovery = readJson(path.resolve(requireOption(options, 'recovery')))
  const report = compareSnapshots(source, recovery)
  writeJson(path.resolve(requireOption(options, 'output')), report)
  if (report.status !== 'GO') throw new Error(`TASK-062 NO-GO: ${report.errors.join('; ')}`)
  process.stdout.write(`${JSON.stringify({ status: report.status })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
