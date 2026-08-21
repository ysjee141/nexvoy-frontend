const fs = require('node:fs')
const path = require('node:path')

const root = __dirname
const candidateRoot = path.join(root, 'candidates', 'user-vector-repair')
const candidateOutput = path.join(candidateRoot, 'output')
const candidateInput = path.join(candidateRoot, 'input')
const referenceRoot = path.join(root, 'reference')

const colors = {
  logoNavy: '#3342B3',
  logoCoral: '#F8725A',
  appBlue: '#3342B3',
  appCoral: '#F8725A',
  white: '#FFFFFF',
  border: '#E2E8F0',
}

function normalizeLogoColors(svg) {
  return svg
    .replaceAll('#051F46', colors.logoNavy)
    .replaceAll('#FD5644', colors.logoCoral)
}

function normalizeAppColors(svg) {
  return svg
    .replaceAll('#192F82', colors.appBlue)
    .replaceAll('#DE6653', colors.appCoral)
}

function inner(svg) {
  return svg
    .replace(/^\s*<\?xml[^>]*>\s*/i, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/<desc[^>]*>[\s\S]*?<\/desc>/i, '')
    .trim()
}

function documentSvg(width, height, title, desc, children) {
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${desc}</desc>${children}</svg>\n`
}

function write(name, width, height, title, desc, children) {
  fs.writeFileSync(path.join(root, name), documentSvg(width, height, title, desc, children))
}

function copyReferenceInputs() {
  fs.copyFileSync(path.join(candidateInput, 'logo-reference.png'), path.join(referenceRoot, 'approved-primary-logo-reference.png'))
  fs.copyFileSync(path.join(candidateInput, 'app-icon-reference.png'), path.join(referenceRoot, 'approved-app-icon-reference.png'))
}

function applyLogoAssets() {
  const primary = normalizeLogoColors(inner(fs.readFileSync(path.join(candidateOutput, 'logo-corrected.svg'), 'utf8')))
  write(
    'logo-gallae-primary.svg',
    1024,
    571,
    '갈래 primary 로고',
    '사용자 승인 raster를 기준으로 정리한 갈래 primary clean vector 로고. 상단 wordmark는 원본 path를 보존하고 누락된 하단 glyph와 route를 보정했다.',
    primary,
  )
  fs.copyFileSync(path.join(root, 'logo-gallae-primary.svg'), path.join(root, 'logo-gallae.svg'))

  const route = primary.match(/<g transform="translate\(50,280\)">([\s\S]*?)<\/g>/)
  if (!route) throw new Error('Unable to extract the approved route group')
  write(
    'route-symbol.svg',
    950,
    270,
    '갈래 경로 심벌',
    '승인된 primary 로고에서 분리한 route와 waypoint vector symbol',
    route[1],
  )

  const lockup = (name, width, height, scale, x, y, title, desc) => {
    write(name, width, height, title, desc, `<g transform="translate(${x},${y}) scale(${scale})">${primary}</g>`)
  }
  lockup(
    'logo-gallae-vertical.svg',
    520,
    360,
    0.45,
    29.6,
    51.5,
    '갈래 세로 락업',
    '승인된 primary 로고를 좁은 세로 영역에 배치한 clean vector 락업',
  )
  lockup(
    'logo-gallae-horizontal.svg',
    780,
    400,
    0.68,
    41.8,
    5.8,
    '갈래 가로 락업',
    '승인된 primary 로고를 넓은 가로 영역에 배치한 clean vector 락업',
  )
}

function applyAppIconAssets() {
  const approved = normalizeAppColors(inner(fs.readFileSync(path.join(candidateOutput, 'app-icon-corrected.svg'), 'utf8')))
  write(
    'app-icon.svg',
    446,
    446,
    '갈래 기본 앱 아이콘',
    '승인된 raster를 기준으로 배경, 흰색 route wordmark와 Coral waypoint를 정리한 clean vector 앱 아이콘',
    approved,
  )
  fs.copyFileSync(path.join(root, 'app-icon.svg'), path.join(root, 'app-icon-dark.svg'))
  fs.copyFileSync(path.join(root, 'app-icon.svg'), path.join(root, 'favicon.svg'))

  const light = approved
    .replace(/fill="#3342B3"/g, `fill="${colors.white}" stroke="${colors.border}" stroke-width="1.5"`)
    .replace(/stroke="#FFFFFF"/g, `stroke="${colors.appBlue}"`)
  write(
    'app-icon-light.svg',
    446,
    446,
    '갈래 밝은 앱 아이콘',
    '밝은 표면 위에 승인된 갈래 심볼을 배치한 clean vector 앱 아이콘',
    light,
  )

  const outline = approved
    .replace(/fill="#3342B3"/g, `fill="${colors.white}" stroke="${colors.appCoral}" stroke-width="1.5"`)
    .replace(/stroke="#FFFFFF"/g, `stroke="${colors.appBlue}"`)
  write(
    'app-icon-outline.svg',
    446,
    446,
    '갈래 아웃라인 앱 아이콘',
    'Coral outline과 승인된 갈래 심볼을 결합한 보조 clean vector 앱 아이콘',
    outline,
  )

  const coral = approved
    .replace(/fill="#3342B3"/g, `fill="${colors.appCoral}"`)
    .replace(/cx="339" cy="290\.5" r="36\.5" fill="#F8725A"/, `cx="339" cy="290.5" r="36.5" fill="${colors.appBlue}"`)
  write(
    'app-icon-coral.svg',
    446,
    446,
    '갈래 Coral 앱 아이콘',
    'Coral 배경 위에 흰색 갈래 심볼과 Deep Navy waypoint를 배치한 캠페인용 clean vector 앱 아이콘',
    coral,
  )
}

function main() {
  fs.mkdirSync(referenceRoot, { recursive: true })
  copyReferenceInputs()
  applyLogoAssets()
  applyAppIconAssets()
  console.log('Approved v12 brand assets applied.')
}

if (require.main === module) main()

module.exports = { main }
