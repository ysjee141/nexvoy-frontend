const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const pngDir = path.join(root, 'png')

const colors = {
  primary: '#2563EB',
  active: '#1D4ED8',
  pale: '#BFDBFE',
  white: '#FFFFFF',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  hairline: '#E2E8F0',
  surface: '#F8FAFC',
}

const appIconMarkScale = 0.78
const appIconMarkOffset = (1024 * (1 - appIconMarkScale)) / 2

function markElements({ first, clock, second, check, jieut, inner, fold }) {
  return `<circle cx="195" cy="474" r="100" fill="none" stroke="${first}" stroke-width="64"/>
    <path d="M195 474V432M195 474L227 493" fill="none" stroke="${clock}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="495" cy="474" r="100" fill="none" stroke="${second}" stroke-width="64"/>
    <path d="M455 474L485 504L539 448" fill="none" stroke="${check}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M695 342H875Q885 342 894 347L944 368Q958 374 944 380L894 401Q885 406 875 406H695C677 406 663 392 663 374C663 356 677 342 695 342Z" fill="${jieut}"/>
    <path d="M816 357L924 369L884 389L861 374L842 389Z" fill="${inner}"/>
    <path d="M854 374L902 369L867 379Z" fill="${fold}"/>
    <path d="M815 405L735 575M815 405L895 575" fill="none" stroke="${jieut}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>`
}

const appElements = markElements({
  first: colors.pale,
  clock: colors.white,
  second: colors.white,
  check: colors.white,
  jieut: colors.white,
  inner: colors.primary,
  fold: colors.white,
})

const defaultElements = markElements({
  first: colors.primary,
  clock: colors.primary,
  second: colors.active,
  check: colors.active,
  jieut: colors.primary,
  inner: colors.white,
  fold: colors.primary,
})

const monoElements = markElements({
  first: colors.primary,
  clock: colors.primary,
  second: colors.primary,
  check: colors.primary,
  jieut: colors.primary,
  inner: colors.white,
  fold: colors.primary,
})

const assets = {
  'app-icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="${colors.primary}"/>
    <g transform="translate(${appIconMarkOffset} ${appIconMarkOffset}) scale(${appIconMarkScale})">${appElements}</g>
  </svg>`,
  'brand-mark': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defaultElements}</svg>`,
  'brand-mark-reverse': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${appElements}</svg>`,
  'brand-mark-mono': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${monoElements}</svg>`,
  favicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="13" fill="${colors.primary}"/>
    <circle cx="14" cy="30" r="7" fill="none" stroke="${colors.pale}" stroke-width="4.5"/>
    <circle cx="33.5" cy="30" r="7" fill="none" stroke="${colors.white}" stroke-width="4.5"/>
    <path d="M46 23H58" fill="none" stroke="${colors.white}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M52 25L46.5 38M52 25L57.5 38" fill="none" stroke="${colors.white}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  construction: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#FFF9EC"/>
    <g fill="none" stroke="#D8DEE6" stroke-width="2">
      <path d="M48 342H976M48 374H976M48 474H976M48 607H976"/>
      <path d="M63 280V670M327 280V670M363 280V670M627 280V670M663 280V670M958 280V670"/>
    </g>
    <g fill="${colors.muted}" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="20">
      <text x="48" y="238">상단선 342</text>
      <text x="260" y="238">비행기 중심 369</text>
      <text x="500" y="238">심벌 중심 474</text>
      <text x="742" y="238">하단선 607</text>
      <text x="335" y="700">36px</text>
      <text x="635" y="700">36px</text>
    </g>
    ${defaultElements}
  </svg>`,
  'wordmark-lockup': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 500">
    <g transform="translate(20 -112) scale(.62)">${defaultElements}</g>
    <text x="700" y="238" fill="${colors.ink}" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="112" font-weight="700" letter-spacing="0">온여정</text>
    <text x="708" y="326" fill="${colors.muted}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="58" font-weight="600" letter-spacing="0">OnVoy</text>
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
  fs.mkdirSync(pngDir, { recursive: true })
  for (const [name, svg] of Object.entries(assets)) fs.writeFileSync(path.join(root, `${name}.svg`), svg)

  const app = await renderSquare('app-icon', 1024)
  for (const size of [512, 192, 64, 32]) await renderSquare('app-icon', size)
  const mark = await renderSquare('brand-mark', 1024)
  const reverse = await renderSquare('brand-mark-reverse', 1024)
  const mono = await renderSquare('brand-mark-mono', 1024)
  const construction = await renderSquare('construction', 1024)
  const lockup = await renderAsset('wordmark-lockup', 1600, 500)
  const favicons = {}
  for (const size of [64, 32, 16]) favicons[size] = await renderSquare('favicon', size)

  const width = 2000
  const height = 1450
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <clipPath id="appMask"><rect x="70" y="218" width="410" height="410" rx="92"/></clipPath>
    </defs>
    <style>
      text{font-family:"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0}
      .title{font-size:52px;font-weight:700;fill:${colors.ink}}
      .subtitle{font-size:23px;fill:${colors.muted}}
      .section{font-size:23px;font-weight:700;fill:${colors.ink}}
      .body{font-size:18px;font-weight:500;fill:${colors.body}}
      .caption{font-size:16px;fill:${colors.muted}}
      .stage{font-size:21px;font-weight:700;fill:${colors.ink}}
      .stageSub{font-size:16px;fill:${colors.muted}}
    </style>
    <rect width="${width}" height="${height}" fill="${colors.surface}"/>
    <text x="70" y="74" class="title">온여정 Brand System v6</text>
    <text x="70" y="120" class="subtitle">ㅇㅇㅈ · 계획 → 준비 → 출발 · 수평 종이비행기와 5px 상향 광학 보정</text>

    <rect x="48" y="156" width="454" height="514" rx="20" fill="${colors.white}" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="70" y="198" class="section">앱 아이콘</text>
    <image href="${toDataUrl(app)}" x="70" y="218" width="410" height="410" clip-path="url(#appMask)"/>

    <rect x="534" y="156" width="710" height="244" rx="20" fill="${colors.white}" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="562" y="198" class="section">기본 마크</text>
    <image href="${toDataUrl(mark)}" x="602" y="176" width="570" height="220"/>

    <rect x="534" y="426" width="710" height="244" rx="20" fill="${colors.primary}"/>
    <text x="562" y="468" class="section" style="fill:#FFFFFF">반전 마크</text>
    <image href="${toDataUrl(reverse)}" x="602" y="446" width="570" height="220"/>

    <rect x="1276" y="156" width="676" height="514" rx="20" fill="${colors.white}" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="1304" y="198" class="section">브랜드 서사</text>
    <line x1="1382" y1="318" x2="1842" y2="318" stroke="#DBEAFE" stroke-width="6" stroke-linecap="round"/>
    <circle cx="1382" cy="318" r="52" fill="#EFF6FF"/>
    <circle cx="1612" cy="318" r="52" fill="#EFF6FF"/>
    <circle cx="1842" cy="318" r="52" fill="#EFF6FF"/>
    <circle cx="1382" cy="318" r="30" fill="none" stroke="${colors.primary}" stroke-width="14"/>
    <path d="M1382 318V302M1382 318L1395 326" fill="none" stroke="${colors.primary}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="1612" cy="318" r="30" fill="none" stroke="${colors.active}" stroke-width="14"/>
    <path d="M1596 318L1609 331L1631 308" fill="none" stroke="${colors.active}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M1805 294H1860Q1866 294 1872 297L1902 309Q1910 312 1902 315L1872 328Q1866 331 1860 331H1805Q1794 331 1794 312Q1794 294 1805 294Z" fill="${colors.primary}"/>
    <path d="M1861 302L1900 307L1885 318L1875 311L1868 318Z" fill="${colors.white}"/>
    <path d="M1880 311L1896 307L1884 313Z" fill="${colors.primary}"/>
    <text x="1358" y="414" class="stage">계획</text><text x="1332" y="444" class="stageSub">시간을 정한다</text>
    <text x="1588" y="414" class="stage">준비</text><text x="1562" y="444" class="stageSub">준비를 마친다</text>
    <text x="1818" y="414" class="stage">출발</text><text x="1792" y="444" class="stageSub">여정을 시작한다</text>
    <text x="1304" y="526" class="body">첫 ㅇ은 계획, 둘째 ㅇ은 준비 완료를 뜻한다.</text>
    <text x="1304" y="560" class="body">ㅈ의 윗획 안쪽 종이비행기는 출발을 뜻한다.</text>
    <text x="1304" y="594" class="caption">멀리서는 ㅇㅇㅈ, 가까이서는 기능과 여행의 단서가 보인다.</text>

    <rect x="48" y="706" width="920" height="690" rx="20" fill="#FFF9EC" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="76" y="748" class="section">구조와 여백</text>
    <image href="${toDataUrl(construction)}" x="126" y="748" width="760" height="600"/>
    <text x="76" y="1360" class="caption">외곽 64px · 내부 16px · 글자 사이 실제 여백 36px · 비행기 중심선 대비 5px 상향</text>

    <rect x="1000" y="706" width="952" height="270" rx="20" fill="${colors.white}" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="1028" y="748" class="section">워드마크 조합</text>
    <image href="${toDataUrl(lockup)}" x="1050" y="756" width="850" height="210"/>

    <rect x="1000" y="1008" width="456" height="388" rx="20" fill="${colors.white}" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="1028" y="1050" class="section">반응형 심벌</text>
    <image href="${toDataUrl(app)}" x="1030" y="1100" width="112" height="112"/>
    <image href="${toDataUrl(app)}" x="1180" y="1124" width="64" height="64"/>
    <image href="${toDataUrl(app)}" x="1282" y="1140" width="32" height="32"/>
    <text x="1030" y="1244" class="caption">64px 이상: 전체 서사</text>
    <text x="1030" y="1278" class="caption">32px: ㅇㅇㅈ 실루엣 우선</text>
    <image href="${toDataUrl(favicons[16])}" x="1030" y="1312" width="16" height="16"/>
    <text x="1064" y="1327" class="caption">16px: 전용 단순 favicon</text>

    <rect x="1488" y="1008" width="464" height="388" rx="20" fill="${colors.white}" stroke="${colors.hairline}" stroke-width="2"/>
    <text x="1516" y="1050" class="section">브랜드 컬러</text>
    <circle cx="1540" cy="1110" r="18" fill="${colors.primary}"/><text x="1574" y="1117" class="body">Primary #2563EB</text>
    <circle cx="1540" cy="1170" r="18" fill="${colors.active}"/><text x="1574" y="1177" class="body">Active #1D4ED8</text>
    <circle cx="1540" cy="1230" r="18" fill="${colors.pale}"/><text x="1574" y="1237" class="body">Pale #BFDBFE</text>
    <circle cx="1540" cy="1290" r="18" fill="${colors.white}" stroke="${colors.hairline}"/><text x="1574" y="1297" class="body">On Primary #FFFFFF</text>
    <text x="1516" y="1352" class="caption">UI 토큰은 DESIGN.md를 단일 기준으로 사용한다.</text>
  </svg>`

  fs.writeFileSync(path.join(root, 'brand-system.svg'), board)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, 'brand-system.png'))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
