const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const pngRoot = path.join(root, 'png')
const colors = {
  navy: '#0D2340',
  coral: '#FF6B5C',
  ink: '#1D2433',
  muted: '#667085',
  border: '#D9DEEA',
  surface: '#FFFFFF',
  background: '#F7F8FC',
  warm: '#FBF8F4',
}

const assets = {
  primary: 'logo-gallae-primary.svg',
  vertical: 'logo-gallae-vertical.svg',
  horizontal: 'logo-gallae-horizontal.svg',
  symbol: 'route-symbol.svg',
  light: 'app-icon-light.svg',
  dark: 'app-icon-dark.svg',
  coral: 'app-icon-coral.svg',
  outline: 'app-icon-outline.svg',
}

function dataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

async function render(name, width, height) {
  const buffer = await sharp(path.join(root, assets[name]))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(pngRoot, `${name}-${width}x${height}.png`), buffer)
  return buffer
}

async function main() {
  fs.mkdirSync(pngRoot, { recursive: true })
  const rendered = {
    primary: await render('primary', 1050, 390),
    vertical: await render('vertical', 360, 220),
    horizontal: await render('horizontal', 390, 190),
    symbol: await render('symbol', 300, 150),
    light: await render('light', 180, 180),
    dark: await render('dark', 180, 180),
    coral: await render('coral', 180, 180),
    outline: await render('outline', 180, 180),
  }
  const iconPngs = [rendered.light, rendered.dark, rendered.coral, rendered.outline]
    .map((buffer, index) => `<image href="${dataUrl(buffer)}" x="${index * 195}" y="0" width="170" height="170" preserveAspectRatio="xMidYMid meet"/>`)
    .join('')

  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1600" viewBox="0 0 1800 1600">
  <style>
    text{font-family:"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0}
    .title{font-size:42px;font-weight:700;fill:${colors.ink}}
    .subtitle{font-size:18px;fill:${colors.muted}}
    .section{font-size:20px;font-weight:700;fill:${colors.ink}}
    .body{font-size:16px;fill:${colors.ink}}
    .caption{font-size:14px;fill:${colors.muted}}
  </style>
  <rect width="1800" height="1600" fill="${colors.background}"/>
  <rect x="36" y="36" width="1728" height="1528" rx="18" fill="${colors.surface}" stroke="${colors.border}"/>
  <text x="78" y="92" class="title">갈래 Brand System v11</text>
  <text x="78" y="126" class="subtitle">함께 찾는 여행의 방향 · 갈림길의 선택 + 이어지는 경로 + 목적지의 설렘</text>
  <line x1="78" y1="166" x2="1722" y2="166" stroke="${colors.border}"/>

  <text x="78" y="214" class="section">PRIMARY LOGO</text>
  <rect x="78" y="238" width="1100" height="330" rx="12" fill="${colors.warm}"/>
  <image href="${dataUrl(rendered.primary)}" x="112" y="250" width="1030" height="310" preserveAspectRatio="xMidYMid meet"/>
  <text x="1232" y="270" class="section">APP ICON</text>
  <image href="${dataUrl(rendered.dark)}" x="1232" y="300" width="320" height="320" preserveAspectRatio="xMidYMid meet"/>
  <text x="1232" y="650" class="caption">Deep Navy base · wordmark + route</text>

  <line x1="78" y1="694" x2="1722" y2="694" stroke="${colors.border}"/>
  <text x="78" y="742" class="section">LOGO VARIATIONS</text>
  <rect x="78" y="766" width="520" height="232" fill="${colors.surface}"/>
  <image href="${dataUrl(rendered.vertical)}" x="112" y="782" width="452" height="196" preserveAspectRatio="xMidYMid meet"/>
  <text x="112" y="1028" class="caption">VERTICAL LOCKUP</text>
  <line x1="618" y1="766" x2="618" y2="1038" stroke="${colors.border}"/>
  <rect x="650" y="766" width="520" height="232" fill="${colors.surface}"/>
  <image href="${dataUrl(rendered.horizontal)}" x="678" y="782" width="464" height="196" preserveAspectRatio="xMidYMid meet"/>
  <text x="678" y="1028" class="caption">HORIZONTAL LOCKUP</text>
  <line x1="1190" y1="766" x2="1190" y2="1038" stroke="${colors.border}"/>
  <rect x="1222" y="766" width="500" height="232" fill="${colors.surface}"/>
  <image href="${dataUrl(rendered.symbol)}" x="1262" y="798" width="420" height="160" preserveAspectRatio="xMidYMid meet"/>
  <text x="1262" y="1028" class="caption">SYMBOL ONLY</text>

  <line x1="78" y1="1072" x2="1722" y2="1072" stroke="${colors.border}"/>
  <text x="78" y="1120" class="section">APP ICON EXAMPLES</text>
  <rect x="78" y="1144" width="930" height="300" fill="${colors.surface}"/>
  <g transform="translate(126 1190)">${iconPngs}</g>
  <text x="126" y="1410" class="caption">light · dark · coral · outline</text>
  <rect x="1040" y="1144" width="682" height="300" fill="${colors.surface}"/>
  <text x="1072" y="1192" class="section">COLOR PALETTE</text>
  <circle cx="1112" cy="1262" r="32" fill="${colors.navy}"/><text x="1166" y="1269" class="body">DEEP NAVY · #0D2340</text>
  <circle cx="1112" cy="1342" r="32" fill="${colors.coral}"/><text x="1166" y="1349" class="body">CORAL · #FF6B5C</text>

  <line x1="78" y1="1484" x2="1722" y2="1484" stroke="${colors.border}"/>
  <text x="78" y="1532" class="section">DESIGN CONCEPT</text>
  <text x="410" y="1532" class="body">갈래 = 함께 고르는 방향</text>
  <text x="850" y="1532" class="body">경로 = 선택이 이어지는 과정</text>
  <text x="1320" y="1532" class="body">웨이포인트 = 다음 목적지</text>
</svg>`

  fs.writeFileSync(path.join(root, 'brand-system.svg'), board)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, 'brand-system.png'))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
