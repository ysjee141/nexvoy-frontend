const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = __dirname
const referenceRoot = path.join(root, 'reference')
const outputRoot = root
const vtracer = process.env.VTRACER_BIN || 'vtracer'

const commonOptions = [
  '--mode', 'spline',
  '--clustering', 'color-cluster',
  '--hierarchical', 'cutout',
  '--filter-speckle', '2',
  '--simplify', '1.5',
  '--max-colors', '8',
  '--gradient-step', '16',
  '--optimize', '2',
]

const assets = [
  ['primary-logo', 'logo-gallae-primary.svg', '갈래 primary 로고', '제공 브랜드 보드의 primary 로고를 VTracer spline path로 재현한 true-vector 자산'],
  ['logo-vertical', 'logo-gallae-vertical.svg', '갈래 세로 락업', '제공 브랜드 보드의 세로 로고 락업을 VTracer spline path로 재현한 true-vector 자산'],
  ['logo-horizontal', 'logo-gallae-horizontal.svg', '갈래 가로 락업', '제공 브랜드 보드의 가로 로고 락업을 VTracer spline path로 재현한 true-vector 자산'],
  ['route-symbol', 'route-symbol.svg', '갈래 경로 심벌', '제공 브랜드 보드의 경로와 웨이포인트 심벌을 VTracer spline path로 재현한 true-vector 자산'],
  ['app-icon-light', 'app-icon-light.svg', '갈래 밝은 앱 아이콘', '제공 브랜드 보드의 밝은 배경 앱 아이콘을 VTracer spline path로 재현한 true-vector 자산'],
  ['app-icon-dark', 'app-icon-dark.svg', '갈래 기본 앱 아이콘', '제공 브랜드 보드의 딥 네이비 앱 아이콘을 VTracer spline path로 재현한 true-vector 자산'],
  ['app-icon-coral', 'app-icon-coral.svg', '갈래 코랄 앱 아이콘', '제공 브랜드 보드의 코랄 앱 아이콘을 VTracer spline path로 재현한 true-vector 자산'],
  ['app-icon-outline', 'app-icon-outline.svg', '갈래 아웃라인 앱 아이콘', '제공 브랜드 보드의 아웃라인 앱 아이콘을 VTracer spline path로 재현한 true-vector 자산'],
]

function nearWhite(color) {
  const value = color.replace('#', '')
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
  return channels.every((channel) => channel > 238)
}

function removeCanvasBackground(svg, width, height) {
  return svg.replace(/<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"\/>/g, (match, d, fill) => {
    const coversCanvas = nearWhite(fill) && d.includes(`M0,${height}`)
    return coversCanvas ? '' : match
  })
}

function addMetadata(svg, width, height, title, desc) {
  const openingTag = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`
  return svg.replace(/<svg[^>]*>/, `${openingTag}\n<title id="title">${title}</title>\n<desc id="desc">${desc}</desc>`)
}

function trace(input, output, title, desc) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gallae-v11-vtracer-'))
  const tracedPath = path.join(tempRoot, 'traced.svg')
  execFileSync(vtracer, [input, tracedPath, ...commonOptions], { stdio: 'inherit' })
  const traced = fs.readFileSync(tracedPath, 'utf8')
  const metadata = traced.match(/<svg[^>]*width="([0-9.]+)"[^>]*height="([0-9.]+)"/)
  if (!metadata) throw new Error(`Unable to read VTracer dimensions for ${input}`)
  const width = Number(metadata[1])
  const height = Number(metadata[2])
  const cleaned = removeCanvasBackground(traced, width, height)
  fs.writeFileSync(output, addMetadata(cleaned, width, height, title, desc))
}

function main() {
  for (const [inputName, outputName, title, desc] of assets) {
    trace(
      path.join(referenceRoot, `${inputName}-reference.png`),
      path.join(outputRoot, outputName),
      title,
      desc,
    )
  }
  fs.copyFileSync(path.join(outputRoot, 'app-icon-dark.svg'), path.join(outputRoot, 'app-icon.svg'))
  fs.copyFileSync(path.join(outputRoot, 'app-icon-dark.svg'), path.join(outputRoot, 'favicon.svg'))
  fs.copyFileSync(path.join(outputRoot, 'logo-gallae-primary.svg'), path.join(outputRoot, 'logo-gallae.svg'))
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
