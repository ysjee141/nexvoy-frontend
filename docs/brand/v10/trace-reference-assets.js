const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = __dirname
const referenceRoot = path.join(root, 'reference')
const vtracer = process.env.VTRACER_BIN || 'vtracer'

const commonOptions = [
  '--mode', 'spline',
  '--clustering', 'color-cluster',
  '--hierarchical', 'cutout',
  '--filter-speckle', '4',
  '--simplify', '1.5',
  '--gradient-step', '16',
  '--optimize', '2',
]

const logoOptions = [...commonOptions, '--color-precision', '5', '--max-colors', '10']
const iconOptions = [...commonOptions, '--max-colors', '8']

function addMetadata(svg, { width, height, title, desc }) {
  const openingTag = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`
  return svg.replace(/<svg[^>]*>/, `${openingTag}\n<title id="title">${title}</title>\n<desc id="desc">${desc}</desc>`)
}

function trace(input, output, metadata, options) {
  execFileSync(vtracer, [input, output, ...options], { stdio: 'inherit' })
  const traced = fs.readFileSync(output, 'utf8')
  fs.writeFileSync(output, addMetadata(traced, metadata))
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gallae-vtracer-'))
  const logoOutput = path.join(tempRoot, 'logo.svg')
  const iconOutput = path.join(tempRoot, 'app-icon.svg')

  trace(
    path.join(referenceRoot, 'logo-gallae-reference.png'),
    logoOutput,
    {
      width: 1024,
      height: 571,
      title: '갈래',
      desc: '제공 레퍼런스를 VTracer spline path로 재현한 갈래 워드마크',
    },
    logoOptions,
  )
  trace(
    path.join(referenceRoot, 'app-icon-reference.png'),
    iconOutput,
    {
      width: 446,
      height: 446,
      title: '갈래 앱 아이콘',
      desc: '제공 레퍼런스를 VTracer spline path로 재현한 경로 앱 아이콘',
    },
    iconOptions,
  )

  fs.copyFileSync(logoOutput, path.join(root, 'logo-gallae-reference-vector.svg'))
  fs.copyFileSync(iconOutput, path.join(root, 'app-icon-reference-vector.svg'))
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
