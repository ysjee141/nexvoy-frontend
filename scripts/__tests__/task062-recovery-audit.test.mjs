import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  DEV_PROJECT_REF,
  PRODUCTION_PROJECT_REF,
  buildBackupManifest,
  compareSnapshots,
  validateLinkedProjectRef,
  validateProjectRefs,
} from '../task062-recovery-audit.mjs'

const RECOVERY_REF = 'abcdefghijklmnopqrst'

function snapshot(role, projectRef) {
  const tables = Object.fromEntries([
    'trips',
    'plans',
    'checklists',
    'checklist_items',
    'checklist_templates',
    'checklist_template_items',
    'document_members',
    'trip_authority_state',
    'template_authority_state',
    'applied_operations',
    'trip_asset_objects',
  ].map((name) => [name, { count: 1, digest: `${name}-digest` }]))
  return {
    task: 'TASK-062',
    role,
    projectRef,
    releaseSha: '4a8b374',
    tables,
    storage: { bucket: 'place-photos', objectCount: 2, digest: 'storage-digest' },
  }
}

test('rejects DEV or Production as a recovery target', () => {
  assert.throws(() => validateProjectRefs(DEV_PROJECT_REF, DEV_PROJECT_REF), /달라야/)
  assert.throws(() => validateProjectRefs(DEV_PROJECT_REF, PRODUCTION_PROJECT_REF), /Production/)
})

test('requires Supabase CLI to be linked to the DEV source', () => {
  assert.equal(validateLinkedProjectRef(DEV_PROJECT_REF, DEV_PROJECT_REF), DEV_PROJECT_REF)
  assert.throws(
    () => validateLinkedProjectRef(PRODUCTION_PROJECT_REF, DEV_PROJECT_REF),
    /linked ref/,
  )
})

test('creates a checksum-only manifest for required backup files', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'task062-backup-'))
  try {
    for (const name of ['schema.sql', 'data.sql', 'roles.sql', 'place-photos.manifest']) {
      writeFileSync(path.join(directory, name), `${name}\n`)
    }
    mkdirSync(path.join(directory, 'place-photos'))
    writeFileSync(path.join(directory, 'place-photos', 'asset.webp'), 'asset-bytes')
    const manifest = buildBackupManifest({
      backupDir: directory,
      sourceRef: DEV_PROJECT_REF,
      recoveryRef: RECOVERY_REF,
      releaseSha: '4a8b374',
    })
    assert.equal(manifest.fileCount, 5)
    assert.equal(manifest.files.some((file) => file.path === 'data.sql'), true)
    assert.equal(manifest.files.some((file) => file.path === 'place-photos/asset.webp'), true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('compares source and recovery snapshots without exposing rows', () => {
  const source = snapshot('source', DEV_PROJECT_REF)
  const recovery = snapshot('recovery', RECOVERY_REF)
  assert.equal(compareSnapshots(source, recovery).status, 'GO')
  recovery.tables.plans.count = 2
  const report = compareSnapshots(source, recovery)
  assert.equal(report.status, 'NO-GO')
  assert.match(report.errors.join(' '), /plans/)
})
