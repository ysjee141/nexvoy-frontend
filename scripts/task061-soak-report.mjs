#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEV_PROJECT_REF = 'ivgkqzwosbjukonlpfdw'
export const EXPECTED_DAYS = 7

const REQUIRED_WORKLOAD = [
  'onlineEdit',
  'offlineReconnect',
  'collaboratorEdit',
  'invitation',
  'assetUpload',
]
const REQUIRED_QUOTAS = [
  'database_size_bytes',
  'storage_size_bytes',
  'egress_bytes',
  'realtime_messages',
]
const THRESHOLDS = {
  queueAgeP95Ms: 30_000,
  rejectedRate: 0.001,
  retryableRate: 0.02,
  conflictRate: 0.01,
  rpcDurationP95Ms: 2_000,
  invalidationGapRate: 0.005,
  fullRefreshRate: 0.05,
  quotaProjectedPercent: 0.7,
}

function parseArguments(argv) {
  const [command, ...rest] = argv
  if (!command || !['init', 'validate'].includes(command)) {
    throw new Error('사용법: task061-soak-report.mjs <init|validate> [options]')
  }
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (argument === '--allow-incomplete' || argument === '--force') {
      options[argument.slice(2)] = true
      continue
    }
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

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`잘못된 날짜: ${value}`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`잘못된 날짜: ${value}`)
  }
  return date
}

function addDays(date, amount) {
  return new Date(date.getTime() + amount * 86_400_000).toISOString().slice(0, 10)
}

function assertReleaseSha(value) {
  if (!/^[a-f0-9]{7,40}$/i.test(value)) throw new Error('release SHA는 7~40자리 hex여야 합니다.')
}

export function buildDayTemplate({ date, releaseSha }) {
  return {
    task: 'TASK-061',
    status: 'pending',
    date,
    projectRef: DEV_PROJECT_REF,
    releaseSha,
    workload: Object.fromEntries(REQUIRED_WORKLOAD.map((name) => [name, 0])),
    authority: {
      queueAgeMs: [],
      appliedCommands: 0,
      rejectedCommands: 0,
      intendedRejectedCommands: 0,
      retryableCommands: 0,
      conflictCommands: 0,
      rpcDurationMs: [],
      invalidationsReceived: 0,
      invalidationGaps: 0,
      fullRefreshes: 0,
    },
    android: {
      fatalCrashes: 0,
      unhandledRejections: 0,
    },
    incidents: {
      dataLoss: 0,
      permission: 0,
      duplicateCanonicalRows: 0,
    },
    quota: REQUIRED_QUOTAS.map((name) => ({
      name,
      used: 0,
      limit: 0,
      projectionFactor: 1,
    })),
    evidence: [],
    notes: [],
  }
}

export function initializeEvidence({ evidenceDir, startDate, releaseSha, force = false }) {
  assertReleaseSha(releaseSha)
  const start = parseDate(startDate)
  const manifestPath = path.join(evidenceDir, 'manifest.json')
  if (existsSync(manifestPath) && !force) {
    throw new Error(`${manifestPath}가 이미 존재합니다. 덮어쓰려면 --force를 사용하세요.`)
  }
  const dates = Array.from({ length: EXPECTED_DAYS }, (_, index) => addDays(start, index))
  mkdirSync(path.join(evidenceDir, 'days'), { recursive: true })
  const manifest = {
    task: 'TASK-061',
    projectRef: DEV_PROJECT_REF,
    releaseSha,
    startDate,
    expectedDays: EXPECTED_DAYS,
    dates,
    createdAt: new Date().toISOString(),
  }
  writeJson(manifestPath, manifest)
  for (const date of dates) {
    writeJson(
      path.join(evidenceDir, 'days', `${date}.json`),
      buildDayTemplate({ date, releaseSha }),
    )
  }
  return manifest
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

function finiteNumber(value, label, errors, { minimum = 0 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    errors.push(`${label}은 ${minimum} 이상의 숫자여야 합니다.`)
    return 0
  }
  return value
}

function numberArray(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} 표본이 필요합니다.`)
    return []
  }
  const numbers = value.filter((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)
  if (numbers.length !== value.length) errors.push(`${label}에는 0 이상의 숫자만 사용할 수 있습니다.`)
  return numbers
}

export function percentile95(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null
}

function validateDay(day, manifest) {
  const errors = []
  if (day.task !== 'TASK-061') errors.push('task 값은 TASK-061이어야 합니다.')
  if (day.projectRef !== DEV_PROJECT_REF) errors.push(`projectRef는 DEV ${DEV_PROJECT_REF}여야 합니다.`)
  if (day.releaseSha !== manifest.releaseSha) errors.push('releaseSha가 manifest와 다릅니다.')
  if (!manifest.dates.includes(day.date)) errors.push('date가 manifest 관측 기간 밖입니다.')

  for (const name of REQUIRED_WORKLOAD) {
    const count = finiteNumber(day.workload?.[name], `workload.${name}`, errors)
    if (count < 1) errors.push(`workload.${name}은 매일 1회 이상 필요합니다.`)
  }

  const authority = day.authority ?? {}
  const queueAgeMs = numberArray(authority.queueAgeMs, 'authority.queueAgeMs', errors)
  const rpcDurationMs = numberArray(authority.rpcDurationMs, 'authority.rpcDurationMs', errors)
  const applied = finiteNumber(authority.appliedCommands, 'authority.appliedCommands', errors)
  const rejected = finiteNumber(authority.rejectedCommands, 'authority.rejectedCommands', errors)
  const intendedRejected = finiteNumber(
    authority.intendedRejectedCommands,
    'authority.intendedRejectedCommands',
    errors,
  )
  const retryable = finiteNumber(authority.retryableCommands, 'authority.retryableCommands', errors)
  const conflicts = finiteNumber(authority.conflictCommands, 'authority.conflictCommands', errors)
  const received = finiteNumber(authority.invalidationsReceived, 'authority.invalidationsReceived', errors)
  const gaps = finiteNumber(authority.invalidationGaps, 'authority.invalidationGaps', errors)
  const fullRefreshes = finiteNumber(authority.fullRefreshes, 'authority.fullRefreshes', errors)
  const attempted = applied + rejected + retryable + conflicts
  if (applied < 1 || attempted < 1) errors.push('적용된 authority command가 1건 이상 필요합니다.')
  if (received < 1) errors.push('Realtime invalidation 수신이 1건 이상 필요합니다.')
  if (intendedRejected > rejected) {
    errors.push('intendedRejectedCommands는 rejectedCommands보다 클 수 없습니다.')
  }

  const metrics = {
    queueAgeP95Ms: percentile95(queueAgeMs),
    rejectedRate: rate(Math.max(0, rejected - intendedRejected), attempted),
    retryableRate: rate(retryable, attempted),
    conflictRate: rate(conflicts, applied),
    rpcDurationP95Ms: percentile95(rpcDurationMs),
    invalidationGapRate: rate(gaps, received),
    fullRefreshRate: rate(fullRefreshes, received),
  }
  for (const [name, maximum] of Object.entries(THRESHOLDS)) {
    if (name === 'quotaProjectedPercent') continue
    const value = metrics[name]
    if (value !== null && value > maximum) {
      errors.push(`${name}=${value}가 임계치 ${maximum}을 초과했습니다.`)
    }
  }

  for (const name of ['fatalCrashes', 'unhandledRejections']) {
    if (finiteNumber(day.android?.[name], `android.${name}`, errors) > 0) {
      errors.push(`android.${name}은 0이어야 합니다.`)
    }
  }
  for (const name of ['dataLoss', 'permission', 'duplicateCanonicalRows']) {
    if (finiteNumber(day.incidents?.[name], `incidents.${name}`, errors) > 0) {
      errors.push(`incidents.${name}은 0이어야 합니다.`)
    }
  }

  const quota = Array.isArray(day.quota) ? day.quota : []
  const quotaByName = new Map(quota.map((entry) => [entry?.name, entry]))
  const quotaProjection = {}
  for (const name of REQUIRED_QUOTAS) {
    const entry = quotaByName.get(name)
    if (!entry) {
      errors.push(`quota.${name} 증적이 필요합니다.`)
      continue
    }
    const used = finiteNumber(entry.used, `quota.${name}.used`, errors)
    const limit = finiteNumber(entry.limit, `quota.${name}.limit`, errors, { minimum: Number.EPSILON })
    const projectionFactor = finiteNumber(
      entry.projectionFactor,
      `quota.${name}.projectionFactor`,
      errors,
      { minimum: Number.EPSILON },
    )
    const projectedPercent = limit > 0 ? used * projectionFactor / limit : null
    quotaProjection[name] = projectedPercent
    if (projectedPercent !== null && projectedPercent >= THRESHOLDS.quotaProjectedPercent) {
      errors.push(`quota.${name} 월 예상치가 ${(projectedPercent * 100).toFixed(2)}%입니다.`)
    }
  }
  if (
    !Array.isArray(day.evidence)
    || day.evidence.length === 0
    || day.evidence.some((entry) => typeof entry !== 'string' || !entry.trim())
  ) {
    errors.push('원시 지표 또는 화면 증적 경로가 1개 이상 필요합니다.')
  } else if (day.evidence.some((entry) => (
    entry.includes('@')
    || /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(entry)
    || /\beyJ[A-Za-z0-9_-]+\./.test(entry)
  ))) {
    errors.push('evidence 경로에 이메일, UUID 또는 token 형태를 사용할 수 없습니다.')
  }

  return { date: day.date, status: errors.length === 0 ? 'pass' : 'fail', metrics, quotaProjection, errors }
}

export function validateEvidenceDirectory({ evidenceDir, allowIncomplete = false, outputPath }) {
  const manifestPath = path.join(evidenceDir, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error(`${manifestPath}가 없습니다.`)
  const manifest = readJson(manifestPath)
  if (manifest.task !== 'TASK-061' || manifest.projectRef !== DEV_PROJECT_REF) {
    throw new Error('TASK-061 DEV manifest가 아닙니다.')
  }
  assertReleaseSha(manifest.releaseSha)
  if (manifest.expectedDays !== EXPECTED_DAYS || !Array.isArray(manifest.dates)) {
    throw new Error('manifest 관측 기간은 7일이어야 합니다.')
  }
  const expectedDates = Array.from(
    { length: EXPECTED_DAYS },
    (_, index) => addDays(parseDate(manifest.startDate), index),
  )
  if (JSON.stringify(manifest.dates) !== JSON.stringify(expectedDates)) {
    throw new Error('manifest 날짜는 startDate부터 연속 7일이어야 합니다.')
  }

  const results = []
  const incompleteDates = []
  for (const date of manifest.dates) {
    const filePath = path.join(evidenceDir, 'days', `${date}.json`)
    if (!existsSync(filePath)) {
      incompleteDates.push(date)
      continue
    }
    const day = readJson(filePath)
    if (day.status !== 'complete') {
      incompleteDates.push(date)
      continue
    }
    results.push(validateDay(day, manifest))
  }

  const failedDates = results.filter((result) => result.status === 'fail').map((result) => result.date)
  const complete = incompleteDates.length === 0
  const report = {
    task: 'TASK-061',
    generatedAt: new Date().toISOString(),
    projectRef: DEV_PROJECT_REF,
    releaseSha: manifest.releaseSha,
    status: failedDates.length > 0 ? 'NO-GO' : complete ? 'GO' : 'IN-PROGRESS',
    completedDays: results.length,
    expectedDays: EXPECTED_DAYS,
    incompleteDates,
    failedDates,
    thresholds: THRESHOLDS,
    days: results,
  }
  const target = outputPath ?? path.join(evidenceDir, 'report.json')
  writeJson(target, report)
  if (failedDates.length > 0 || (!allowIncomplete && !complete)) {
    const reason = failedDates.length > 0
      ? `실패 일자: ${failedDates.join(', ')}`
      : `미완료 일자: ${incompleteDates.join(', ')}`
    throw new Error(`TASK-061 ${report.status}: ${reason}`)
  }
  return report
}

function main() {
  const { command, options } = parseArguments(process.argv.slice(2))
  const evidenceDir = path.resolve(requireOption(options, 'evidence-dir'))
  if (command === 'init') {
    const manifest = initializeEvidence({
      evidenceDir,
      startDate: requireOption(options, 'start'),
      releaseSha: requireOption(options, 'release-sha'),
      force: options.force === true,
    })
    process.stdout.write(`${JSON.stringify({ status: 'initialized', evidenceDir, dates: manifest.dates })}\n`)
    return
  }
  const report = validateEvidenceDirectory({
    evidenceDir,
    allowIncomplete: options['allow-incomplete'] === true,
    outputPath: typeof options.output === 'string' ? path.resolve(options.output) : undefined,
  })
  process.stdout.write(`${JSON.stringify({ status: report.status, completedDays: report.completedDays })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
