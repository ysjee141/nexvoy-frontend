const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const sharp = require('sharp')

const root = __dirname
const inputRoot = path.join(root, 'input')
const outputRoot = path.join(root, 'output')

const colors = {
  logoNavy: '#051F46',
  logoCoral: '#FD5644',
  appBlue: '#192F82',
  appCoral: '#DE6653',
  white: '#FFFFFF',
}

async function traceCleanRoute() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gallae-user-route-'))
  const input = path.join(tempRoot, 'route-input.png')
  const traced = path.join(tempRoot, 'route.svg')
  const { data, info } = await sharp(path.join(inputRoot, 'logo-reference.png'))
    .extract({ left: 50, top: 280, width: 950, height: 270 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const coral = [253, 86, 68]
  const white = [255, 255, 255]
  for (let index = 0; index < data.length; index += info.channels) {
    const rgb = [data[index], data[index + 1], data[index + 2]]
    const distance = Math.hypot(rgb[0] - coral[0], rgb[1] - coral[1], rgb[2] - coral[2])
    const color = distance < 70 ? coral : white
    data[index] = color[0]
    data[index + 1] = color[1]
    data[index + 2] = color[2]
    data[index + 3] = 255
  }
  await sharp(data, { raw: info }).png().toFile(input)
  execFileSync(process.env.VTRACER_BIN || 'vtracer', [
    input,
    traced,
    '--mode', 'spline',
    '--clustering', 'color-cluster',
    '--hierarchical', 'cutout',
    '--filter-speckle', '2',
    '--color-precision', '8',
    '--gradient-step', '0',
    '--simplify', '1.2',
    '--path-precision', '2',
    '--palette', '#FD5644,#FFFFFF',
    '--optimize', '2',
  ], { stdio: 'inherit' })
  const routeSvg = fs.readFileSync(traced, 'utf8')
  const coralGroup = routeSvg.match(/<g fill="#FD5644">([\s\S]*?)<\/g>/)
  const groupedColored = coralGroup ? [...coralGroup[1].matchAll(/<path d="([^"]+)"\/>/g)].map((match) => match[1]) : []
  const directColored = [...routeSvg.matchAll(/<path d="([^"]+)" fill="#FD5644"\/>/g)].map((match) => match[1])
  const colored = directColored.length ? directColored : groupedColored
  const whitePaths = [...routeSvg.matchAll(/<path d="([^"]+)" fill="#FFFFFF"\/>/g)].map((match) => match[1])
  if (!colored[0] || !whitePaths.at(-1)) throw new Error('Unable to extract a clean route and waypoint hole')
  return `<g transform="translate(50,280)"><path d="${colored[0]}" fill="${colors.logoCoral}"/><path d="${whitePaths.at(-1)}" fill="${colors.white}"/></g>`
}

function cleanLowerGlyph() {
  // The fifth source path is incomplete, so only this glyph is rebuilt.
  return `<path d="M210 258 H397 C409 258 418 271 418 290 C418 307 409 320 397 320 H240 C223 320 208 336 208 354 C208 372 223 387 240 387 H446" fill="none" stroke="${colors.logoNavy}" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>`
}

function sourceWordmark() {
  const source = fs.readFileSync(path.join(inputRoot, 'logo-source.svg'), 'utf8')
  const paths = [...source.matchAll(/<path d="([\s\S]*?)"\s*\/>/g)].map((match) => match[1])
  if (paths.length < 4) throw new Error(`Expected at least 4 logo wordmark paths, got ${paths.length}`)
  const sourcePaths = paths.slice(0, 4)
    .map((d) => `<path d="${d}" fill="${colors.logoNavy}"/>`)
    .join('')
  return `<g transform="translate(0,571) scale(0.1,-0.1)">${sourcePaths}</g>${cleanLowerGlyph()}`
}

async function repairLogo() {
  const wordmark = sourceWordmark()
  const route = await traceCleanRoute()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1024" height="571" viewBox="0 0 1024 571" role="img" aria-labelledby="title desc"><title id="title">갈래 primary logo candidate</title><desc id="desc">원본 PNG의 비례를 참고해 직선 구간과 둥근 끝점을 재구성한 clean wordmark와 vector route 후보 자산</desc>${wordmark}${route}</svg>\n`
  fs.writeFileSync(path.join(outputRoot, 'logo-corrected.svg'), svg)
}

function repairAppIcon() {
  const iconSymbol = `<path d="M98 137 H211 C238 137 257 155 257 181 C257 207 239 223 213 223 H173 C148 223 144 241 144 267 V270 C144 296 158 312 184 312 H316" fill="none" stroke="${colors.white}" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>`
  const waypoint = `<circle cx="339" cy="290.5" r="36.5" fill="${colors.appCoral}"/><circle cx="339" cy="290.5" r="17" fill="${colors.white}"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="446" height="446" viewBox="0 0 446 446" role="img" aria-labelledby="title desc"><title id="title">갈래 app icon candidate</title><desc id="desc">둥근 정사각형 위에 직선 구간과 둥근 끝점을 재구성한 흰색 심볼 및 Coral waypoint 후보 자산</desc><rect x="10" y="10" width="426" height="426" rx="94" fill="${colors.appBlue}"/>${iconSymbol}${waypoint}</svg>\n`
  fs.writeFileSync(path.join(outputRoot, 'app-icon-corrected.svg'), svg)
}

function dataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function metric(reference, candidate) {
  let changed = 0
  let total = 0
  for (let i = 0; i < reference.length; i += 3) {
    const delta = Math.abs(reference[i] - candidate[i]) + Math.abs(reference[i + 1] - candidate[i + 1]) + Math.abs(reference[i + 2] - candidate[i + 2])
    total += delta
    if (delta > 24) changed += 1
  }
  return { changedPixelsOver24Delta: changed, totalAbsoluteRgbDelta: total }
}

async function compare(name, referenceFile, candidateFile, width, height) {
  const reference = await sharp(path.join(inputRoot, referenceFile)).resize(width, height).flatten({ background: colors.white }).png().toBuffer()
  const candidate = await sharp(path.join(outputRoot, candidateFile)).resize(width, height).flatten({ background: colors.white }).png().toBuffer()
  await sharp(candidate).toFile(path.join(outputRoot, `${name}-corrected.png`))
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 3}" height="${height + 48}" viewBox="0 0 ${width * 3} ${height + 48}"><rect width="${width * 3}" height="${height + 48}" fill="#F3F5F9"/><text x="24" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">REFERENCE PNG</text><text x="${width + 24}" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">CORRECTED SVG</text><text x="${width * 2 + 24}" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">OVERLAY 50%</text><image href="${dataUrl(reference)}" x="0" y="48" width="${width}" height="${height}"/><image href="${dataUrl(candidate)}" x="${width}" y="48" width="${width}" height="${height}"/><image href="${dataUrl(reference)}" x="${width * 2}" y="48" width="${width}" height="${height}"/><image href="${dataUrl(candidate)}" x="${width * 2}" y="48" width="${width}" height="${height}" opacity=".5"/></svg>`
  await sharp(Buffer.from(board)).png().toFile(path.join(outputRoot, `${name}-comparison.png`))
  const referenceRaw = await sharp(reference).raw().toBuffer()
  const candidateRaw = await sharp(candidate).raw().toBuffer()
  return metric(referenceRaw, candidateRaw)
}

async function compareLogoDetail() {
  const crop = { left: 130, top: 30, width: 730, height: 390 }
  const detailWidth = 1460
  const detailHeight = 780
  const reference = await sharp(path.join(inputRoot, 'logo-reference.png'))
    .extract(crop)
    .resize(detailWidth, detailHeight)
    .png()
    .toBuffer()
  const candidate = await sharp(path.join(outputRoot, 'logo-corrected.svg'))
    .extract(crop)
    .resize(detailWidth, detailHeight)
    .png()
    .toBuffer()
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${detailWidth * 2}" height="${detailHeight + 52}" viewBox="0 0 ${detailWidth * 2} ${detailHeight + 52}"><rect width="100%" height="100%" fill="#F3F5F9"/><text x="24" y="34" font-family="Arial,sans-serif" font-size="24" fill="#1D2433">REFERENCE DETAIL</text><text x="${detailWidth + 24}" y="34" font-family="Arial,sans-serif" font-size="24" fill="#1D2433">CLEAN VECTOR DETAIL</text><image href="${dataUrl(reference)}" x="0" y="52" width="${detailWidth}" height="${detailHeight}"/><image href="${dataUrl(candidate)}" x="${detailWidth}" y="52" width="${detailWidth}" height="${detailHeight}"/></svg>`
  await sharp(Buffer.from(board)).png().toFile(path.join(outputRoot, 'logo-detail-comparison.png'))
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true })
  await repairLogo()
  repairAppIcon()
  const logo = await compare('logo', 'logo-reference.png', 'logo-corrected.svg', 1024, 571)
  const appIcon = await compare('app-icon', 'app-icon-reference.png', 'app-icon-corrected.svg', 446, 446)
  await compareLogoDetail()
  fs.writeFileSync(path.join(outputRoot, 'repair-metrics.json'), JSON.stringify({ colors, logo, appIcon, detailCrop: { left: 130, top: 30, width: 730, height: 390 } }, null, 2) + '\n')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
