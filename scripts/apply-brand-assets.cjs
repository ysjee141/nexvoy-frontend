const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const repositoryRoot = path.resolve(__dirname, '..')

const brandRoot = path.join(repositoryRoot, 'docs/brand/v6')
const mobileRoot = path.join(repositoryRoot, 'apps/mobile/assets/branding')
const mobileSourceRoot = path.join(mobileRoot, 'source')
const mobileStoreRoot = path.join(mobileRoot, 'store')
const webAppRoot = path.join(repositoryRoot, 'apps/web/app')
const webPublicRoot = path.join(repositoryRoot, 'apps/web/public')
const webIconRoot = path.join(webPublicRoot, 'icons')

const PRIMARY = '#2563EB'
const SURFACE = '#F8FAFC'
const INK = '#0F172A'
const MUTED = '#64748B'
const ADAPTIVE_MARK_SCALE = 0.58
const ADAPTIVE_MARK_OFFSET = (1024 * (1 - ADAPTIVE_MARK_SCALE)) / 2
const ADAPTIVE_MONO_OFFSET = (64 * (1 - ADAPTIVE_MARK_SCALE)) / 2

function readBrandSvg(name) {
  return fs.readFileSync(path.join(brandRoot, name), 'utf8')
}

function svgBody(svg) {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

async function renderPng(svg, filePath, width, height = width) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(filePath)
}

function createIco(pngBuffers, sizes) {
  const directorySize = 6 + sizes.length * 16
  const header = Buffer.alloc(directorySize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  let offset = directorySize
  pngBuffers.forEach((png, index) => {
    const entry = 6 + index * 16
    const size = sizes[index]
    header.writeUInt8(size === 256 ? 0 : size, entry)
    header.writeUInt8(size === 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })

  return Buffer.concat([header, ...pngBuffers])
}

async function main() {
  const appIcon = readBrandSvg('app-icon.svg')
  const brandMark = readBrandSvg('brand-mark.svg')
  const reverseMark = readBrandSvg('brand-mark-reverse.svg')
  const favicon = readBrandSvg('favicon.svg')

  const adaptiveForeground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <g transform="translate(${ADAPTIVE_MARK_OFFSET} ${ADAPTIVE_MARK_OFFSET}) scale(${ADAPTIVE_MARK_SCALE})">${svgBody(reverseMark)}</g>
  </svg>`

  const compactMonoBody = svgBody(favicon)
    .replace(/<rect[^>]*\/>/, '')
    .replaceAll('#BFDBFE', '#000000')
    .replaceAll('#FFFFFF', '#000000')
    .trim()

  const adaptiveMono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <g transform="translate(${ADAPTIVE_MONO_OFFSET} ${ADAPTIVE_MONO_OFFSET}) scale(${ADAPTIVE_MARK_SCALE})">${compactMonoBody}</g>
  </svg>`

  const notificationMono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <g transform="translate(8 8) scale(.75)">${compactMonoBody}</g>
  </svg>`

  const featureGraphic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500">
    <rect width="1024" height="500" fill="${SURFACE}"/>
    <defs><clipPath id="app-icon"><rect x="80" y="90" width="320" height="320" rx="72"/></clipPath></defs>
    <image href="${svgDataUrl(appIcon)}" x="80" y="90" width="320" height="320" clip-path="url(#app-icon)"/>
    <text x="480" y="205" fill="${INK}" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="74" font-weight="750">온여정</text>
    <text x="484" y="260" fill="${PRIMARY}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">OnVoy</text>
    <text x="482" y="332" fill="${MUTED}" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="28" font-weight="600">계획부터 출발까지, 여행을 온전히</text>
  </svg>`

  writeFile(path.join(mobileSourceRoot, 'app-icon.svg'), appIcon)
  writeFile(path.join(mobileSourceRoot, 'adaptive-foreground.svg'), adaptiveForeground)
  writeFile(path.join(mobileSourceRoot, 'monochrome-mark.svg'), adaptiveMono)
  writeFile(path.join(mobileSourceRoot, 'notification-mark.svg'), notificationMono)
  writeFile(path.join(mobileSourceRoot, 'splash-icon.svg'), brandMark)
  writeFile(path.join(mobileSourceRoot, 'play-store-feature-graphic.svg'), featureGraphic)

  await renderPng(appIcon, path.join(mobileRoot, 'icon.png'), 1024)
  await renderPng(adaptiveForeground, path.join(mobileRoot, 'adaptive-icon.png'), 1024)
  await renderPng(adaptiveMono, path.join(mobileRoot, 'adaptive-icon-monochrome.png'), 1024)
  await renderPng(notificationMono, path.join(mobileRoot, 'notification-icon.png'), 96)
  await renderPng(brandMark, path.join(mobileRoot, 'splash-icon.png'), 512)
  await renderPng(appIcon, path.join(mobileStoreRoot, 'play-store-icon.png'), 512)
  await renderPng(featureGraphic, path.join(mobileStoreRoot, 'play-store-feature-graphic.png'), 1024, 500)

  writeFile(path.join(webAppRoot, 'icon.svg'), favicon)
  await renderPng(appIcon, path.join(webAppRoot, 'apple-icon.png'), 180)
  await renderPng(favicon, path.join(webPublicRoot, 'logo.png'), 640)
  await renderPng(favicon, path.join(webPublicRoot, 'brand/onvoy-app-icon-v6.png'), 640)
  await renderPng(appIcon, path.join(webIconRoot, 'onvoy-192.png'), 192)
  await renderPng(appIcon, path.join(webIconRoot, 'onvoy-512.png'), 512)
  await renderPng(appIcon, path.join(webIconRoot, 'onvoy-maskable-512.png'), 512)

  const faviconSizes = [16, 32, 48]
  const faviconPngs = await Promise.all(
    faviconSizes.map((size) => sharp(Buffer.from(favicon)).resize(size, size).png().toBuffer()),
  )
  writeFile(path.join(webAppRoot, 'favicon.ico'), createIco(faviconPngs, faviconSizes))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
