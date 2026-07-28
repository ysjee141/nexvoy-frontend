import { spawn } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(projectRoot, '../..')
const envPath = path.join(projectRoot, '.env.local')
const easConfigPath = path.join(projectRoot, 'eas.json')
const easIgnorePath = path.join(workspaceRoot, '.easignore')
const gitIgnorePath = path.join(workspaceRoot, '.gitignore')
const forwardedPublicEnvKeys = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_APP_URL',
]

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadLocalEnv(envPath)

const args = process.argv.slice(2)
const profileFlagIndex = args.indexOf('--profile')
const profile = profileFlagIndex >= 0 ? args[profileFlagIndex + 1] : undefined
const existingEasIgnore = existsSync(easIgnorePath)
  ? readFileSync(easIgnorePath, 'utf8')
  : null
const previousEasIgnore = existingEasIgnore?.includes(
  '# Local EAS build inputs. This temporary file is removed by eas-local-build.mjs.',
)
  ? null
  : existingEasIgnore
const previousEasConfig = readFileSync(easConfigPath, 'utf8')
const gitIgnore = readFileSync(gitIgnorePath, 'utf8')
const localBuildExcludes = [
  '/apps/mobile/.expo/',
  '/apps/mobile/android/',
  '/apps/mobile/dist/',
  '/apps/mobile/ios/',
  '/apps/mobile/web-build/',
  '/apps/web/.next/',
  '/apps/web/coverage/',
  '/apps/web/out/',
  '/apps/web/playwright-report/',
  '/apps/web/styled-system/',
  '/apps/web/test-results/',
]
const localBuildIncludes = [
  '!apps/mobile/google-services.json',
  '!apps/mobile/GoogleService-Info.plist',
]

if (!profile) {
  throw new Error('Local EAS builds must specify --profile.')
}

const easConfig = JSON.parse(previousEasConfig)
const buildProfile = easConfig.build?.[profile]
if (!buildProfile) {
  throw new Error(`Unknown EAS build profile: ${profile}`)
}

buildProfile.env = {
  ...(buildProfile.env ?? {}),
  ...Object.fromEntries(
    forwardedPublicEnvKeys
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  ),
}
let child
let resultCode = 1
const signalHandlers = new Map()

try {
  writeFileSync(easConfigPath, `${JSON.stringify(easConfig, null, 2)}\n`)
  writeFileSync(
    easIgnorePath,
    `${gitIgnore.trimEnd()}

# Mobile generated directories normally excluded by apps/mobile/.gitignore.
${localBuildExcludes.join('\n')}

# Local EAS build inputs. This temporary file is removed by eas-local-build.mjs.
${localBuildIncludes.join('\n')}
`,
    { mode: 0o600 },
  )

  child = spawn('pnpm', ['exec', 'eas', 'build', ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => child?.kill(signal)
    signalHandlers.set(signal, handler)
    process.on(signal, handler)
  }

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  resultCode = result.code ?? (result.signal === 'SIGINT' ? 130 : 1)
} finally {
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler)
  }
  if (previousEasIgnore === null) {
    if (existsSync(easIgnorePath)) unlinkSync(easIgnorePath)
  } else {
    writeFileSync(easIgnorePath, previousEasIgnore)
  }
  writeFileSync(easConfigPath, previousEasConfig)
}

process.exit(resultCode)
