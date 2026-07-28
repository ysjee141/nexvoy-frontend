#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEV_PROJECT_REF = 'ivgkqzwosbjukonlpfdw'
const root = process.cwd()
const mobileRoot = path.join(root, 'apps/mobile')
const androidHome = process.env.ANDROID_HOME
  ?? process.env.ANDROID_SDK_ROOT
  ?? path.join(os.homedir(), 'Library/Android/sdk')
const adbPath = path.join(androidHome, 'platform-tools/adb')
const emulatorPath = path.join(androidHome, 'emulator/emulator')
const evidenceRoot = process.env.TASK060_EVIDENCE_DIR
  ?? path.join(root, '_workspace/task060/evidence')

function run(command, args = [], options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd ?? root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout ?? 30_000,
    }).trim()
  } catch (error) {
    if (options.optional) return ''
    const stderr = error?.stderr?.toString().trim()
    throw new Error(`${command} 실패${stderr ? `: ${stderr}` : ''}`)
  }
}

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

function maskedId(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 10)
}

function fileEvidence(relativePath) {
  const filePath = path.join(root, relativePath)
  if (!existsSync(filePath)) return { path: relativePath, present: false }
  return {
    path: relativePath,
    present: true,
    sha256: createHash('sha256').update(readFileSync(filePath)).digest('hex'),
  }
}

function androidDevices() {
  if (!existsSync(adbPath)) return []
  const output = run(adbPath, ['devices', '-l'], { optional: true })
  return output
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...metadata] = line.trim().split(/\s+/)
      const model = metadata.find((value) => value.startsWith('model:'))?.slice(6)
      const device = metadata.find((value) => value.startsWith('device:'))?.slice(7)
      return {
        id: maskedId(serial),
        state,
        model: model ?? device ?? 'unknown',
      }
    })
}

function androidAvds() {
  if (!existsSync(emulatorPath)) return []
  return run(emulatorPath, ['-list-avds'], { optional: true })
    .split(/\r?\n/)
    .filter(Boolean)
}

function iosSimulators() {
  const output = run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
    optional: true,
  })
  if (!output) return []
  const parsed = JSON.parse(output)
  return Object.entries(parsed.devices ?? {}).flatMap(([runtime, devices]) =>
    devices
      .filter((device) => device.isAvailable !== false)
      .map((device) => ({
        runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
        name: device.name,
        state: device.state,
        id: maskedId(device.udid),
      })))
}

function physicalIosDevices() {
  const output = run('xcrun', ['xctrace', 'list', 'devices'], {
    optional: true,
    timeout: 60_000,
  })
  const devices = []
  let section = ''
  for (const line of output.split(/\r?\n/)) {
    if (line === '== Devices ==') {
      section = 'online'
      continue
    }
    if (line === '== Devices Offline ==') {
      section = 'offline'
      continue
    }
    if (line.startsWith('== Simulators ==')) break
    const match = line.match(/^(.+?) \(([^()]*)\) \(([0-9A-F-]+)\)$/i)
    if (!match || !section || /MacBook|Mac mini|Mac Studio/i.test(match[1])) continue
    devices.push({
      name: match[1].trim(),
      os: match[2],
      state: section,
      id: maskedId(match[3]),
    })
  }
  return devices
}

const mobileEnv = parseEnv(path.join(mobileRoot, '.env.local'))
const supabaseUrl = mobileEnv.EXPO_PUBLIC_SUPABASE_URL
if (!supabaseUrl) throw new Error('apps/mobile/.env.local에 EXPO_PUBLIC_SUPABASE_URL이 없습니다.')
const supabaseHost = new URL(supabaseUrl).host
if (supabaseHost !== `${DEV_PROJECT_REF}.supabase.co`) {
  throw new Error(`TASK-060은 DEV ${DEV_PROJECT_REF}에서만 실행할 수 있습니다.`)
}

const generatedAt = new Date()
const inventory = {
  task: 'TASK-060',
  generatedAt: generatedAt.toISOString(),
  release: {
    sha: run('git', ['rev-parse', 'HEAD']),
    branch: run('git', ['branch', '--show-current']),
    dirty: Boolean(run('git', ['status', '--short'], { optional: true })),
  },
  environment: {
    projectRef: DEV_PROJECT_REF,
    supabaseHost,
    hasAnonKey: Boolean(mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    hasGoogleMapsKey: Boolean(mobileEnv.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
    firebase: {
      android: fileEvidence('apps/mobile/google-services.json'),
      ios: fileEvidence('apps/mobile/GoogleService-Info.plist'),
    },
  },
  tools: {
    node: process.version,
    pnpm: run('pnpm', ['--version']),
    xcode: run('xcodebuild', ['-version'], { optional: true }).replace(/\r?\n/g, ' / '),
    java: run('java', ['--version'], { optional: true }).split(/\r?\n/)[0] ?? '',
    fastlane: run('fastlane', ['--version'], { optional: true }).split(/\r?\n/).at(-1) ?? '',
    cocoapods: run('pod', ['--version'], { optional: true }),
    adb: existsSync(adbPath) ? adbPath : null,
  },
  devices: {
    androidPhysicalAndRunningEmulators: androidDevices(),
    androidAvds: androidAvds(),
    iosPhysical: physicalIosDevices(),
    iosSimulators: iosSimulators(),
  },
  exclusions: {
    oauth: ['google', 'kakao'],
    actualInvitationEmailAcceptance: true,
  },
}

mkdirSync(evidenceRoot, { recursive: true })
const stamp = generatedAt.toISOString().replace(/[:.]/g, '-')
const outputPath = path.join(evidenceRoot, `inventory-${stamp}.json`)
writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`${outputPath}\n`)
