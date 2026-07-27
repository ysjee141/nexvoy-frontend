#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

function parseArguments(argv) {
  const options = {
    manifest: 'supabase/audit/task059-object-manifest.json',
    strict: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--strict') {
      options.strict = true
      continue
    }
    if (!argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`)
    }
    options[argument.slice(2)] = value
    index += 1
  }

  for (const required of ['expected', 'actual']) {
    if (!options[required]) {
      throw new Error(`--${required} is required`)
    }
  }
  return options
}

function normalizeDefinition(value) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeTableDefinition(value) {
  const normalized = normalizeDefinition(value)
  const firstNewline = normalized.indexOf('\n')
  const lastClose = normalized.lastIndexOf('\n)')
  if (firstNewline === -1 || lastClose === -1) return normalized

  const heading = normalized.slice(0, firstNewline)
  const entries = normalized
    .slice(firstNewline + 1, lastClose)
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter(Boolean)
    .sort()
  return `${heading}\n${entries.join('\n')}\n)`
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function objectKey(object) {
  const table = object.table ? `.${object.table}` : ''
  return `${object.type}:${object.schema}${table}.${object.name}`
}

function addStatement(map, key, definition) {
  if (map.has(key)) {
    // The managed Supabase schemas contain overloaded functions. TASK-059
    // deliberately fingerprints app-owned, non-overloaded function names.
    return
  }
  map.set(key, {
    definition: key.startsWith('table:')
      ? normalizeTableDefinition(definition)
      : normalizeDefinition(definition),
    grants: [],
  })
}

function extractStatements(dump) {
  const objects = new Map()
  const functionStartPattern =
    /^CREATE OR REPLACE FUNCTION "([^"]+)"\."([^"]+)"\(/gm
  for (const match of dump.matchAll(functionStartPattern)) {
    const alterPrefix = `\n\n\nALTER FUNCTION "${match[1]}"."${match[2]}"`
    const alterOffset = dump.indexOf(alterPrefix, match.index)
    if (alterOffset === -1) {
      throw new Error(`Could not find ALTER FUNCTION terminator for ${match[1]}.${match[2]}`)
    }
    addStatement(
      objects,
      `function:${match[1]}.${match[2]}`,
      dump.slice(match.index, alterOffset),
    )
  }

  const tablePattern =
    /^CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"\."([^"]+)" \([^]*?^\);\s*$/gm
  for (const match of dump.matchAll(tablePattern)) {
    addStatement(objects, `table:${match[1]}.${match[2]}`, match[0])
  }

  const indexPattern =
    /^CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\."([^"]+)"[^;]+;\s*$/gm
  for (const match of dump.matchAll(indexPattern)) {
    addStatement(objects, `index:${match[2]}.${match[1]}`, match[0])
  }

  const policyPattern =
    /^CREATE POLICY "([^"]+)" ON "([^"]+)"\."([^"]+)"[^;]+;\s*$/gm
  for (const match of dump.matchAll(policyPattern)) {
    addStatement(objects, `policy:${match[2]}.${match[3]}.${match[1]}`, match[0])
  }

  const triggerPattern =
    /^CREATE (?:OR REPLACE )?TRIGGER "([^"]+)"[^;]+ ON "([^"]+)"\."([^"]+)"[^;]+;\s*$/gm
  for (const match of dump.matchAll(triggerPattern)) {
    addStatement(objects, `trigger:${match[2]}.${match[3]}.${match[1]}`, match[0])
  }

  const functionGrantPattern =
    /^GRANT ([A-Z, ]+) ON FUNCTION "([^"]+)"\."([^"]+)"\([^;]+\) TO (.+);$/gm
  for (const match of dump.matchAll(functionGrantPattern)) {
    appendGrant(objects, `function:${match[2]}.${match[3]}`, match[1], match[4])
  }

  const tableGrantPattern =
    /^GRANT ([A-Z, ]+) ON TABLE "([^"]+)"\."([^"]+)" TO (.+);$/gm
  for (const match of dump.matchAll(tableGrantPattern)) {
    appendGrant(objects, `table:${match[2]}.${match[3]}`, match[1], match[4])
  }

  const constraintPattern =
    /^ALTER TABLE ONLY "([^"]+)"\."([^"]+)"\n\s+ADD CONSTRAINT [^;]+;\s*$/gm
  for (const match of dump.matchAll(constraintPattern)) {
    const object = objects.get(`table:${match[1]}.${match[2]}`)
    if (!object) continue
    object.constraints ??= []
    object.constraints.push(normalizeDefinition(match[0]))
  }

  for (const [key, object] of objects) {
    if (!key.startsWith('table:')) continue
    const [, qualifiedName] = key.split(':')
    const [schema, name] = qualifiedName.split('.')
    object.rlsEnabled = new RegExp(
      `^ALTER TABLE "${escapeRegExp(schema)}"\\."${escapeRegExp(name)}" ENABLE ROW LEVEL SECURITY;$`,
      'm',
    ).test(dump)
  }

  return objects
}

function appendGrant(objects, key, privilege, recipients) {
  const object = objects.get(key)
  if (!object) return
  for (const recipient of recipients.split(',').map((value) => value.trim())) {
    object.grants.push({
      privilege: privilege.trim(),
      role: recipient.replace(/^"|"$/g, ''),
    })
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fingerprint(object) {
  if (!object) return { present: false }
  const grants = object.grants
    .map(({ privilege, role }) => `${privilege}:${role}`)
    .sort()
  const constraints = [...(object.constraints ?? [])].sort()
  const material = {
    definition: object.definition,
    grants,
    ...(constraints.length === 0 ? {} : { constraints }),
    ...(object.rlsEnabled === undefined ? {} : { rlsEnabled: object.rlsEnabled }),
  }
  return {
    present: true,
    definitionHash: hash(object.definition),
    grants,
    ...(constraints.length === 0
      ? {}
      : {
          constraintCount: constraints.length,
          constraintsHash: hash(constraints.join('\n\n')),
        }),
    ...(object.rlsEnabled === undefined ? {} : { rlsEnabled: object.rlsEnabled }),
    fingerprint: hash(JSON.stringify(material)),
  }
}

function compareManifest(manifest, expectedObjects, actualObjects) {
  return manifest.versions.map((version) => {
    const objects = version.objects.map((object) => {
      const key = objectKey(object)
      const compare = object.compare ?? version.defaultCompare ?? [
        'definition',
        'constraints',
        'grants',
        'rls',
      ]
      const expected = object.present === false
        ? { present: false }
        : fingerprint(expectedObjects.get(key))
      const actual = fingerprint(actualObjects.get(key))
      const differences = []

      if (expected.present !== actual.present) {
        differences.push(expected.present ? 'missing' : 'unexpected')
      } else if (expected.present) {
        if (
          compare.includes('definition') &&
          expected.definitionHash !== actual.definitionHash
        ) {
          differences.push('definition')
        }
        if (
          compare.includes('grants') &&
          JSON.stringify(expected.grants) !== JSON.stringify(actual.grants)
        ) {
          differences.push('grants')
        }
        if (
          compare.includes('constraints') &&
          expected.constraintsHash !== actual.constraintsHash
        ) {
          differences.push('constraints')
        }
        if (compare.includes('rls') && expected.rlsEnabled !== actual.rlsEnabled) {
          differences.push('rls')
        }
      }

      if (object.present !== false && !expected.present) {
        differences.push('missing_from_expected_dump')
      }

      return {
        key,
        compare,
        status: differences.length === 0 ? 'match' : 'mismatch',
        differences: [...new Set(differences)],
        expected,
        actual,
      }
    })

    const mismatchCount = objects.filter(({ status }) => status === 'mismatch').length
    return {
      version: version.version,
      task: version.task,
      status: mismatchCount === 0 ? 'match' : 'mismatch',
      objectCount: objects.length,
      mismatchCount,
      objects,
    }
  })
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const [manifestText, expectedDump, actualDump] = await Promise.all([
    readFile(options.manifest, 'utf8'),
    readFile(options.expected, 'utf8'),
    readFile(options.actual, 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)
  const versions = compareManifest(
    manifest,
    extractStatements(expectedDump),
    extractStatements(actualDump),
  )
  const summary = {
    versionCount: versions.length,
    matchingVersions: versions.filter(({ status }) => status === 'match').length,
    mismatchingVersions: versions.filter(({ status }) => status === 'mismatch').length,
    objectCount: versions.reduce((total, version) => total + version.objectCount, 0),
    mismatchCount: versions.reduce((total, version) => total + version.mismatchCount, 0),
  }
  const report = {
    generatedAt: new Date().toISOString(),
    manifest: options.manifest,
    expectedDump: options.expected,
    actualDump: options.actual,
    summary,
    versions,
  }
  const serialized = `${JSON.stringify(report, null, 2)}\n`

  if (options.output) {
    await writeFile(options.output, serialized)
  } else {
    process.stdout.write(serialized)
  }

  process.stderr.write(
    `TASK-059 fingerprint: ${summary.matchingVersions}/${summary.versionCount} versions match; ` +
      `${summary.mismatchCount}/${summary.objectCount} object checks differ.\n`,
  )
  for (const version of versions.filter(({ status }) => status === 'mismatch')) {
    const keys = version.objects
      .filter(({ status }) => status === 'mismatch')
      .map(({ key, differences }) => `${key} (${differences.join(',')})`)
    process.stderr.write(`${version.version} ${version.task}: ${keys.join(', ')}\n`)
  }

  if (options.strict && summary.mismatchCount > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
