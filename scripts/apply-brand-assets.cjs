const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const repositoryRoot = path.resolve(__dirname, '..')

const brandRoot = path.join(repositoryRoot, 'docs/brand/v12')
const mobileRoot = path.join(repositoryRoot, 'apps/mobile/assets/branding')
const mobileSourceRoot = path.join(mobileRoot, 'source')
const mobileStoreRoot = path.join(mobileRoot, 'store')
const webAppRoot = path.join(repositoryRoot, 'apps/web/app')
const webPublicRoot = path.join(repositoryRoot, 'apps/web/public')
const webIconRoot = path.join(webPublicRoot, 'icons')

const APP_BLUE = '#192F82'
const APP_CORAL = '#DE6653'
const SURFACE = '#FBF8F4'
const MONOCHROME = '#000000'

function readBrandSvg(name) {
  return fs.readFileSync(path.join(brandRoot, name), 'utf8')
}

function svgBody(svg) {
  return svg
    .replace(/^\s*<\?xml[^>]*>\s*/i, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '')
    .trim()
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

function documentSvg(width, height, title, desc, children) {
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${desc}</desc>${children}</svg>\n`
}

function writeSvg(filePath, width, height, title, desc, children) {
  writeFile(filePath, documentSvg(width, height, title, desc, children))
}

function removeBackground(svg) {
  return svgBody(svg).replace(/<rect[^>]*\/\s*>/i, '').trim()
}

function makeAdaptiveForeground(appIcon) {
  const body = removeBackground(appIcon)
  return documentSvg(
    1024,
    1024,
    '갈래 Android adaptive foreground',
    '앱 아이콘의 벡터 artwork만 Android adaptive icon 안전 영역에 배치한 foreground',
    `<g transform="translate(86 94) scale(1.8)">${body}</g>`,
  )
}

function makeMonochrome(appIcon) {
  const body = removeBackground(appIcon)
    .replaceAll('#FFFFFF', MONOCHROME)
    .replaceAll(APP_CORAL, MONOCHROME)
  return documentSvg(
    1024,
    1024,
    '갈래 Android monochrome icon',
    '앱 아이콘 artwork를 단색으로 변환한 Android themed icon 원본',
    `<g transform="translate(86 94) scale(1.8)">${body}</g>`,
  )
}

function makeNotificationIcon(appIcon) {
  const body = removeBackground(appIcon)
    .replaceAll('#FFFFFF', MONOCHROME)
    .replaceAll(APP_CORAL, MONOCHROME)
  return documentSvg(
    96,
    96,
    '갈래 notification icon',
    '알림 표시 영역에 맞춘 단색 경로와 웨이포인트 심벌',
    `<g transform="translate(-11 -10) scale(.25)">${body}</g>`,
  )
}

function makeSplash(primaryLogo) {
  return documentSvg(
    1024,
    1024,
    '갈래 splash artwork',
    '투명 배경에 중앙 배치한 갈래 primary vector logo',
    `<g transform="translate(128 298) scale(.75)">${svgBody(primaryLogo)}</g>`,
  )
}

function makeFeatureGraphic(primaryLogo) {
  return documentSvg(
    1024,
    500,
    '갈래 Play Store feature graphic',
    '갈래 primary vector logo를 사용한 Play Store feature graphic',
    `<rect width="1024" height="500" fill="${SURFACE}"/><g transform="translate(164 75) scale(.68)">${svgBody(primaryLogo)}</g>`,
  )
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
  const primaryLogo = readBrandSvg('logo-gallae-primary.svg')
  const favicon = readBrandSvg('favicon.svg')
  const adaptiveForeground = makeAdaptiveForeground(appIcon)
  const adaptiveMono = makeMonochrome(appIcon)
  const notificationMono = makeNotificationIcon(appIcon)
  const splash = makeSplash(primaryLogo)
  const featureGraphic = makeFeatureGraphic(primaryLogo)

  writeFile(path.join(mobileSourceRoot, 'app-icon.svg'), appIcon)
  writeFile(path.join(mobileSourceRoot, 'adaptive-foreground.svg'), adaptiveForeground)
  writeFile(path.join(mobileSourceRoot, 'monochrome-mark.svg'), adaptiveMono)
  writeFile(path.join(mobileSourceRoot, 'notification-mark.svg'), notificationMono)
  writeFile(path.join(mobileSourceRoot, 'splash-icon.svg'), splash)
  writeFile(path.join(mobileSourceRoot, 'play-store-feature-graphic.svg'), featureGraphic)

  await renderPng(appIcon, path.join(mobileRoot, 'icon.png'), 1024)
  await renderPng(adaptiveForeground, path.join(mobileRoot, 'adaptive-icon.png'), 1024)
  await renderPng(adaptiveMono, path.join(mobileRoot, 'adaptive-icon-monochrome.png'), 1024)
  await renderPng(notificationMono, path.join(mobileRoot, 'notification-icon.png'), 96)
  await renderPng(splash, path.join(mobileRoot, 'splash-icon.png'), 512)
  await renderPng(appIcon, path.join(mobileStoreRoot, 'play-store-icon.png'), 512)
  await renderPng(featureGraphic, path.join(mobileStoreRoot, 'play-store-feature-graphic.png'), 1024, 500)

  writeFile(path.join(webAppRoot, 'icon.svg'), favicon)
  await renderPng(appIcon, path.join(webAppRoot, 'apple-icon.png'), 180)
  await renderPng(primaryLogo, path.join(webPublicRoot, 'logo.png'), 1024, 571)
  await renderPng(appIcon, path.join(webPublicRoot, 'brand/gallae-app-icon.png'), 640)
  await renderPng(appIcon, path.join(webIconRoot, 'gallae-192.png'), 192)
  await renderPng(appIcon, path.join(webIconRoot, 'gallae-512.png'), 512)
  await renderPng(appIcon, path.join(webIconRoot, 'gallae-maskable-512.png'), 512)

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
