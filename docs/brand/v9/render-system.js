const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const pngRoot = path.join(root, 'png')

const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const body = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value)
}

async function render(svg, file, width, height = width) {
  await sharp(Buffer.from(svg)).resize(width, height, { fit: 'contain' }).png().toFile(file)
}

function brandSystem(wordmark, appIcon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
    <rect width="1600" height="1000" fill="#F7F8FC"/>
    <rect x="56" y="56" width="1488" height="888" rx="24" fill="#FFFFFF" stroke="#D9DEEA"/>
    <text x="104" y="126" fill="#1D2433" font-family="Arial, sans-serif" font-size="34" font-weight="700">갈래 BRAND SYSTEM / v8</text>
    <text x="104" y="168" fill="#667085" font-family="Arial, sans-serif" font-size="20">A soft invitation to choose a place, make a plan, and keep moving together.</text>
    <line x1="104" y1="208" x2="1496" y2="208" stroke="#D9DEEA"/>
    <text x="104" y="266" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">PRIMARY WORDMARK</text>
    <rect x="104" y="296" width="1020" height="410" rx="18" fill="#FBF8F4"/>
    <g transform="translate(146 352) scale(.72)">${body(wordmark)}</g>
    <text x="104" y="766" fill="#667085" font-family="Arial, sans-serif" font-size="20">갈래? / custom Korean lettering + route lockup</text>
    <text x="1190" y="266" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">APP ICON</text>
    <g transform="translate(1190 304) scale(.30)">${body(appIcon)}</g>
    <text x="1190" y="674" fill="#667085" font-family="Arial, sans-serif" font-size="20">route + waypoint</text>
    <text x="104" y="850" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">PALETTE</text>
    <circle cx="104" cy="890" r="18" fill="#3342B3"/><text x="136" y="897" fill="#344054" font-family="Arial, sans-serif" font-size="18">Indigo 700  #3342B3</text>
    <circle cx="390" cy="890" r="18" fill="#4052D2"/><text x="422" y="897" fill="#344054" font-family="Arial, sans-serif" font-size="18">Indigo 600  #4052D2</text>
    <circle cx="676" cy="890" r="18" fill="#F8725A"/><text x="708" y="897" fill="#344054" font-family="Arial, sans-serif" font-size="18">Coral 500  #F8725A</text>
    <circle cx="962" cy="890" r="18" fill="#FFFFFF" stroke="#D9DEEA"/><text x="994" y="897" fill="#344054" font-family="Arial, sans-serif" font-size="18">Surface  #FFFFFF</text>
  </svg>`
}

async function main() {
  const wordmark = read('logo-gallae-question.svg')
  const plain = read('logo-gallae-question-plain.svg')
  const monoDark = read('logo-gallae-question-mono-dark.svg')
  const monoLight = read('logo-gallae-question-mono-light.svg')
  const appIcon = read('app-icon.svg')
  const preview = read('app-icon-preview.svg')
  const monochrome = read('app-icon-monochrome.svg')
  const favicon = read('favicon.svg')
  const construction = read('construction.svg')
  const system = brandSystem(wordmark, appIcon)

  await render(wordmark, path.join(pngRoot, 'logo-gallae-question-1600.png'), 1600, 655)
  await render(plain, path.join(pngRoot, 'logo-gallae-question-plain-1600.png'), 1600, 473)
  await render(monoDark, path.join(pngRoot, 'logo-gallae-question-mono-dark-1600.png'), 1600, 655)
  await render(monoLight, path.join(pngRoot, 'logo-gallae-question-mono-light-1600.png'), 1600, 655)
  await render(appIcon, path.join(pngRoot, 'app-icon-1024.png'), 1024)
  await render(appIcon, path.join(pngRoot, 'app-icon-512.png'), 512)
  await render(appIcon, path.join(pngRoot, 'app-icon-192.png'), 192)
  await render(preview, path.join(pngRoot, 'app-icon-preview-1024.png'), 1024)
  await render(monochrome, path.join(pngRoot, 'app-icon-monochrome-1024.png'), 1024)
  await render(favicon, path.join(pngRoot, 'favicon-64.png'), 64)
  await render(favicon, path.join(pngRoot, 'favicon-32.png'), 32)
  await render(favicon, path.join(pngRoot, 'favicon-16.png'), 16)
  await render(construction, path.join(pngRoot, 'construction-1440.png'), 1440, 760)
  await render(system, path.join(root, 'brand-system.png'), 1600, 1000)
  write(path.join(root, 'brand-system.svg'), system)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
