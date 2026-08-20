const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const pngDir = path.join(root, 'png')

const colors = {
  indigo500: '#5264E5',
  indigo600: '#4052D2',
  indigo700: '#3342B3',
  coral400: '#FF8A70',
  coral500: '#F8725A',
  ink900: '#1D2433',
  ink700: '#344054',
  ink500: '#667085',
  border: '#D9DEEA',
  surface: '#FFFFFF',
  background: '#F7F8FC',
  warm: '#FBF8F4',
}

function routeElements({ route, waypoint, center }) {
  return `<path d="M 212,300 L 512,300 A 100 100 0 0 1 512,500 L 412,500 A 100 100 0 0 0 412,700 L 792,700"
    fill="none" stroke="${route}" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="792" cy="700" r="90" fill="${waypoint}"/>
  <circle cx="792" cy="700" r="36" fill="${center}"/>`
}

function monochromeRouteElements(color) {
  return `<path d="M 212,300 L 512,300 A 100 100 0 0 1 512,500 L 412,500 A 100 100 0 0 0 412,700 L 792,700"
    fill="none" stroke="${color}" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="792" cy="700" r="63" fill="none" stroke="${color}" stroke-width="54"/>`
}

function wordmarkElements(color) {
  const common = `fill="none" stroke="${color}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"`
  return `<path d="M 40,55 L 130,55 Q 150,55 145,85 C 135,120 100,145 40,150" ${common}/>
  <line x1="180" y1="45" x2="180" y2="145" ${common}/>
  <line x1="180" y1="85" x2="225" y2="85" ${common}/>
  <path d="M 60,180 L 165,180 Q 185,180 185,200 Q 185,220 165,220 L 70,220 Q 50,220 50,240 Q 50,260 70,260 C 135,260 195,265 255,285" ${common}/>
  <path d="M 275,55 L 350,55 Q 370,55 370,75 L 370,115 Q 370,135 350,135 L 285,135 Q 265,135 265,155 L 265,195 Q 265,215 285,215 C 325,215 360,200 390,185" ${common}/>
  <line x1="430" y1="45" x2="430" y2="260" ${common}/>
  <line x1="430" y1="135" x2="475" y2="135" ${common}/>
  <line x1="475" y1="45" x2="475" y2="260" ${common}/>`
}

const colorRoute = routeElements({
  route: colors.indigo600,
  waypoint: colors.coral500,
  center: colors.surface,
})

const reverseRoute = routeElements({
  route: colors.surface,
  waypoint: colors.coral500,
  center: colors.surface,
})

const assets = {
  'app-icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="${colors.indigo700}"/>
    ${reverseRoute}
  </svg>`,
  'app-icon-preview': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="180" fill="${colors.indigo700}"/>
    ${reverseRoute}
  </svg>`,
  'app-icon-monochrome': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    ${monochromeRouteElements('#000000')}
  </svg>`,
  'logo-symbol': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${colorRoute}</svg>`,
  'logo-symbol-reverse': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${reverseRoute}</svg>`,
  'logo-gallae-ko': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 325">${wordmarkElements(colors.indigo600)}</svg>`,
  'logo-gallae-ko-mono-dark': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 325">${wordmarkElements(colors.ink900)}</svg>`,
  'logo-gallae-ko-mono-light': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 325">${wordmarkElements(colors.surface)}</svg>`,
  'logo-lockup-gallae-horizontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 500">
    <g transform="translate(18 -238) scale(.72)">${colorRoute}</g>
    <g transform="translate(700 12) scale(1.4)">${wordmarkElements(colors.indigo600)}</g>
  </svg>`,
  favicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="220" fill="${colors.indigo700}"/>
    ${reverseRoute}
  </svg>`,
  construction: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
    <rect width="1600" height="1000" fill="${colors.warm}"/>
    <g fill="none" stroke="${colors.border}" stroke-width="2">
      <path d="M120 205H1480M120 300H1480M120 500H1480M120 700H1480M120 790H1480"/>
      <path d="M212 130V840M312 130V840M412 130V840M512 130V840M612 130V840M792 130V840"/>
      <circle cx="792" cy="700" r="90"/>
    </g>
    <g fill="${colors.ink500}" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="22">
      <text x="120" y="170">공통 경로 construction</text>
      <text x="20" y="287">시작선 300</text>
      <text x="20" y="487">중간선 500</text>
      <text x="20" y="687">종점선 700</text>
      <text x="900" y="708">웨이포인트 중심 792, 700</text>
      <text x="212" y="890">stroke 140 · arc radius 100 · waypoint 90/36 · round cap/join</text>
    </g>
    ${colorRoute}
  </svg>`,
}

const toDataUrl = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`

async function renderSquare(name, size) {
  const buffer = await sharp(Buffer.from(assets[name])).resize(size, size).png().toBuffer()
  fs.writeFileSync(path.join(pngDir, `${name}-${size}.png`), buffer)
  return buffer
}

async function renderAsset(name, width, height) {
  const buffer = await sharp(Buffer.from(assets[name])).resize(width, height).png().toBuffer()
  fs.writeFileSync(path.join(pngDir, `${name}-${width}x${height}.png`), buffer)
  return buffer
}

async function main() {
  fs.rmSync(pngDir, { recursive: true, force: true })
  fs.mkdirSync(pngDir, { recursive: true })
  for (const [name, svg] of Object.entries(assets)) {
    fs.writeFileSync(path.join(root, `${name}.svg`), `${svg}\n`)
  }

  const app = await renderSquare('app-icon', 1024)
  for (const size of [512, 192, 64, 32]) await renderSquare('app-icon', size)
  await renderSquare('app-icon-monochrome', 1024)
  const symbol = await renderSquare('logo-symbol', 1024)
  const symbolReverse = await renderSquare('logo-symbol-reverse', 1024)
  const wordmark = await renderAsset('logo-gallae-ko', 1600, 1000)
  const wordmarkDark = await renderAsset('logo-gallae-ko-mono-dark', 1600, 1000)
  await renderAsset('logo-gallae-ko-mono-light', 1600, 1000)
  const lockup = await renderAsset('logo-lockup-gallae-horizontal', 1600, 500)
  const construction = await renderAsset('construction', 1600, 1000)
  const favicons = {}
  for (const size of [64, 32, 16]) favicons[size] = await renderSquare('favicon', size)

  const width = 2000
  const height = 1500
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><clipPath id="app-mask"><rect x="70" y="220" width="420" height="420" rx="94"/></clipPath></defs>
    <style>
      text{font-family:"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0}
      .title{font-size:52px;font-weight:700;fill:${colors.ink900}}
      .subtitle{font-size:23px;fill:${colors.ink500}}
      .section{font-size:23px;font-weight:700;fill:${colors.ink900}}
      .body{font-size:18px;font-weight:500;fill:${colors.ink700}}
      .caption{font-size:16px;fill:${colors.ink500}}
    </style>
    <rect width="2000" height="1500" fill="${colors.background}"/>
    <text x="70" y="76" class="title">갈래 / Nextward Brand System v7</text>
    <text x="70" y="120" class="subtitle">선택 → 이동 → 다음 방향 · 공통 경로와 웨이포인트</text>

    <rect x="48" y="156" width="464" height="526" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>
    <text x="70" y="198" class="section">앱 아이콘 · Waypoint</text>
    <image href="${toDataUrl(app)}" x="70" y="220" width="420" height="420" clip-path="url(#app-mask)"/>

    <rect x="544" y="156" width="1408" height="252" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>
    <text x="572" y="198" class="section">한국어 워드마크</text>
    <image href="${toDataUrl(wordmark)}" x="640" y="202" width="400" height="194" preserveAspectRatio="xMidYMid meet"/>
    <text x="1060" y="308" class="caption">기본 · Journey Indigo 600</text>
    <image href="${toDataUrl(wordmarkDark)}" x="1330" y="204" width="320" height="194" preserveAspectRatio="xMidYMid meet"/>
    <text x="1668" y="308" class="caption">Mono · Ink 900</text>

    <rect x="544" y="440" width="684" height="242" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>
    <text x="572" y="482" class="section">공통 경로 심벌</text>
    <image href="${toDataUrl(symbol)}" x="620" y="460" width="520" height="210"/>

    <rect x="1260" y="440" width="692" height="242" rx="8" fill="${colors.indigo700}"/>
    <text x="1288" y="482" class="section" style="fill:${colors.surface}">반전 심벌</text>
    <image href="${toDataUrl(symbolReverse)}" x="1340" y="460" width="520" height="210"/>

    <rect x="48" y="714" width="1040" height="730" rx="8" fill="${colors.warm}" stroke="${colors.border}"/>
    <text x="76" y="756" class="section">구조와 비례</text>
    <image href="${toDataUrl(construction)}" x="88" y="760" width="960" height="600"/>
    <text x="76" y="1404" class="caption">경로 stroke 140 · arc 100 · 웨이포인트 90/36 · round cap/join · 고정 비례</text>

    <rect x="1120" y="714" width="832" height="304" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>
    <text x="1148" y="756" class="section">가로형 lockup</text>
    <image href="${toDataUrl(lockup)}" x="1160" y="772" width="760" height="238"/>

    <rect x="1120" y="1050" width="390" height="394" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>
    <text x="1148" y="1092" class="section">반응형 확인</text>
    <image href="${toDataUrl(app)}" x="1150" y="1140" width="112" height="112"/>
    <image href="${toDataUrl(app)}" x="1298" y="1164" width="64" height="64"/>
    <image href="${toDataUrl(app)}" x="1398" y="1180" width="32" height="32"/>
    <image href="${toDataUrl(favicons[16])}" x="1150" y="1300" width="16" height="16"/>
    <text x="1182" y="1315" class="caption">16px 전용 favicon</text>
    <text x="1148" y="1370" class="caption">경로가 먼저, 웨이포인트가 종점을 표시한다.</text>

    <rect x="1542" y="1050" width="410" height="394" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>
    <text x="1570" y="1092" class="section">브랜드 컬러</text>
    <circle cx="1592" cy="1154" r="18" fill="${colors.indigo500}"/><text x="1626" y="1161" class="body">Indigo 500  #5264E5</text>
    <circle cx="1592" cy="1210" r="18" fill="${colors.indigo600}"/><text x="1626" y="1217" class="body">Indigo 600  #4052D2</text>
    <circle cx="1592" cy="1266" r="18" fill="${colors.indigo700}"/><text x="1626" y="1273" class="body">Indigo 700  #3342B3</text>
    <circle cx="1592" cy="1322" r="18" fill="${colors.coral500}"/><text x="1626" y="1329" class="body">Coral 500  #F8725A</text>
    <circle cx="1592" cy="1378" r="18" fill="${colors.surface}" stroke="${colors.border}"/><text x="1626" y="1385" class="body">Surface  #FFFFFF</text>
  </svg>`

  fs.writeFileSync(path.join(root, 'brand-system.svg'), `${board}\n`)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, 'brand-system.png'))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
