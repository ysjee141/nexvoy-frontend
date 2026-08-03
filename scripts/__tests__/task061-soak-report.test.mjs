import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  initializeEvidence,
  validateEvidenceDirectory,
} from '../task061-soak-report.mjs'

function completeDay(filePath) {
  const day = JSON.parse(readFileSync(filePath, 'utf8'))
  day.status = 'complete'
  for (const key of Object.keys(day.workload)) day.workload[key] = 1
  day.authority.queueAgeMs = [100, 1_000]
  day.authority.appliedCommands = 100
  day.authority.rpcDurationMs = [100, 500]
  day.authority.invalidationsReceived = 100
  for (const quota of day.quota) {
    quota.used = 10
    quota.limit = 100
  }
  day.evidence = ['redacted/daily-export.json']
  writeFileSync(filePath, `${JSON.stringify(day, null, 2)}\n`)
}

test('accepts seven consecutive passing DEV soak days', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'task061-pass-'))
  try {
    const manifest = initializeEvidence({
      evidenceDir: directory,
      startDate: '2026-08-01',
      releaseSha: '4a8b374',
    })
    for (const date of manifest.dates) completeDay(path.join(directory, 'days', `${date}.json`))
    const report = validateEvidenceDirectory({ evidenceDir: directory })
    assert.equal(report.status, 'GO')
    assert.equal(report.completedDays, 7)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects a day that exceeds the retryable threshold', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'task061-fail-'))
  try {
    const manifest = initializeEvidence({
      evidenceDir: directory,
      startDate: '2026-08-01',
      releaseSha: '4a8b374',
    })
    for (const date of manifest.dates) completeDay(path.join(directory, 'days', `${date}.json`))
    const firstPath = path.join(directory, 'days', `${manifest.dates[0]}.json`)
    const first = JSON.parse(readFileSync(firstPath, 'utf8'))
    first.authority.retryableCommands = 3
    writeFileSync(firstPath, `${JSON.stringify(first, null, 2)}\n`)
    assert.throws(
      () => validateEvidenceDirectory({ evidenceDir: directory }),
      /TASK-061 NO-GO/,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('reports incomplete evidence without failing during the observation window', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'task061-progress-'))
  try {
    initializeEvidence({
      evidenceDir: directory,
      startDate: '2026-08-01',
      releaseSha: '4a8b374',
    })
    const report = validateEvidenceDirectory({ evidenceDir: directory, allowIncomplete: true })
    assert.equal(report.status, 'IN-PROGRESS')
    assert.equal(report.incompleteDates.length, 7)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects identifying values in committed evidence paths', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'task061-redaction-'))
  try {
    const manifest = initializeEvidence({
      evidenceDir: directory,
      startDate: '2026-08-01',
      releaseSha: '4a8b374',
    })
    for (const date of manifest.dates) completeDay(path.join(directory, 'days', `${date}.json`))
    const firstPath = path.join(directory, 'days', `${manifest.dates[0]}.json`)
    const first = JSON.parse(readFileSync(firstPath, 'utf8'))
    first.evidence = ['exports/user@example.com.json']
    writeFileSync(firstPath, `${JSON.stringify(first, null, 2)}\n`)
    assert.throws(
      () => validateEvidenceDirectory({ evidenceDir: directory }),
      /TASK-061 NO-GO/,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
