const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = __dirname
const inputRoot = path.join(root, 'trace-inputs')
const outputRoot = root
const vtracer = process.env.VTRACER_BIN || 'vtracer'

const traceOptions = [
  '--mode', 'spline',
  '--clustering', 'color-cluster',
  '--hierarchical', 'cutout',
  '--filter-speckle', '5',
  '--color-precision', '8',
  '--gradient-step', '0',
  '--simplify', '1.2',
  '--path-precision', '2',
  '--palette', '#0D2340,#FF6B5C,#FFFFFF',
  '--optimize', '2',
]

const assets = [
  ['primary-logo', 'logo-gallae-primary-trace.svg', '갈래 primary trace', '브랜드 보드 primary 로고의 VTracer QA trace intermediate'],
  ['logo-vertical', 'logo-gallae-vertical-trace.svg', '갈래 세로 trace', '브랜드 보드 세로 락업의 VTracer QA trace intermediate'],
  ['logo-horizontal', 'logo-gallae-horizontal-trace.svg', '갈래 가로 trace', '브랜드 보드 가로 락업의 VTracer QA trace intermediate'],
  ['route-symbol', 'route-symbol-trace.svg', '갈래 경로 trace', '브랜드 보드 경로 심벌의 VTracer QA trace intermediate'],
  ['app-icon-dark', 'app-icon-dark-trace.svg', '갈래 기본 앱 아이콘 trace', '브랜드 보드 기본 앱 아이콘의 VTracer QA trace intermediate'],
  ['app-icon-coral', 'app-icon-coral-trace.svg', '갈래 Coral 앱 아이콘 trace', '브랜드 보드 Coral 앱 아이콘의 VTracer QA trace intermediate'],
  ['app-icon-light', 'app-icon-light-trace.svg', '갈래 밝은 앱 아이콘 추적본', '밝은 앱 아이콘의 VTracer 추적 검수용 중간 자산'],
  ['app-icon-outline', 'app-icon-outline-trace.svg', '갈래 아웃라인 앱 아이콘 추적본', '아웃라인 앱 아이콘의 VTracer 추적 검수용 중간 자산'],
]

function nearWhite(color) {
  const value = color.replace('#', '')
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
  return channels.every((channel) => channel > 238)
}

function removeCanvasBackground(svg, width, height) {
  return svg.replace(/<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"\/>/g, (match, d, fill) => {
    const coversCanvas = nearWhite(fill) && /M\s*0[ ,]/.test(d) && d.includes(`${height}`)
    return coversCanvas ? '' : match
  })
}

function addMetadata(svg, width, height, title, desc) {
  const openingTag = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`
  return svg.replace(/<svg[^>]*>/, `${openingTag}\n<title id="title">${title}</title>\n<desc id="desc">${desc}</desc>`)
}

function trace(input, output, title, desc) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gallae-v12-vtracer-'))
  const tracedPath = path.join(tempRoot, 'traced.svg')
  execFileSync(vtracer, [input, tracedPath, ...traceOptions], { stdio: 'inherit' })
  const traced = fs.readFileSync(tracedPath, 'utf8')
    .replace(/^\s*<\?xml[^>]*>\s*/i, '')
    .replace(/^\s*<!--[^>]*-->\s*/i, '')
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
      path.join(inputRoot, `${inputName}-trace.png`),
      path.join(outputRoot, outputName),
      title,
      desc,
    )
  }
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
