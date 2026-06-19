// Metro 설정 — pnpm 모노레포 대응 (Expo + workspace 심볼릭 링크 해석)
// 핵심: watchFolders=repo root, nodeModulesPaths(앱→루트 순), symlink 해석 활성화.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// 1) 모노레포 루트 전체를 감시하여 @nexvoy/* workspace 패키지 변경 감지
config.watchFolders = [monorepoRoot]

// 2) 앱 node_modules 우선, 없으면 루트 node_modules에서 해석 (pnpm hoist 대응)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// 3) pnpm은 심볼릭 링크 기반이므로 계층적 탐색을 비활성화하지 않고 symlink 해석에 의존
config.resolver.disableHierarchicalLookup = false

// 4) pnpm 가상 스토어 경로(.pnpm) 심볼릭 링크를 따라가도록 unstable_enableSymlinks 보장
config.resolver.unstable_enableSymlinks = true

module.exports = config
