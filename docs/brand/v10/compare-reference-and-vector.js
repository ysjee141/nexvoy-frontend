const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const referenceRoot = path.join(root, 'reference')
const pngRoot = path.join(root, 'png')

function dataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

function metrics(referenceRaw, vectorRaw) {
  let total = 0
  let changed = 0
  for (let index = 0; index < referenceRaw.length; index += 3) {
    const delta = Math.abs(referenceRaw[index] - vectorRaw[index]) + Math.abs(referenceRaw[index + 1] - vectorRaw[index + 1]) + Math.abs(referenceRaw[index + 2] - vectorRaw[index + 2])
    total += delta
    if (delta > 24) changed += 1
  }
  return { changedPixelsOver24Delta: changed, totalAbsoluteRgbDelta: total }
}

function comparisonBoard(reference, vector) {
  const ref = dataUrl(reference)
  const drawn = dataUrl(vector)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1320">
  <rect width="1800" height="1100" fill="#F7F8FC"/>
  <rect x="48" y="48" width="1704" height="1224" rx="24" fill="#FFFFFF" stroke="#D9DEEA"/>
  <text x="96" y="120" fill="#1D2433" font-family="Arial, sans-serif" font-size="34" font-weight="700">REFERENCE / VECTOR COMPARISON</text>
  <text x="96" y="162" fill="#667085" font-family="Arial, sans-serif" font-size="20">The left side is the supplied PNG. The right side is the path-based vector reconstruction.</text>
  <text x="96" y="222" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">SUPPLIED PNG</text>
  <text x="930" y="222" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">TRUE VECTOR SVG</text>
  <rect x="96" y="248" width="820" height="458" fill="#FFFFFF" stroke="#D9DEEA"/>
  <image href="${ref}" x="96" y="248" width="820" height="458" preserveAspectRatio="none"/>
  <rect x="930" y="248" width="820" height="458" fill="#FFFFFF" stroke="#D9DEEA"/>
  <image href="${drawn}" x="930" y="248" width="820" height="458" preserveAspectRatio="none"/>
  <text x="96" y="770" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">OVERLAY / 50% VECTOR</text>
  <rect x="96" y="796" width="820" height="458" fill="#FFFFFF" stroke="#D9DEEA"/>
  <image href="${ref}" x="96" y="796" width="820" height="458" preserveAspectRatio="none"/>
  <image href="${drawn}" x="96" y="796" width="820" height="458" opacity=".5" preserveAspectRatio="none"/>
  <text x="930" y="770" fill="#667085" font-family="Arial, sans-serif" font-size="20">The vector uses only paths, circles, gradients and rectangles.</text>
  <text x="930" y="810" fill="#667085" font-family="Arial, sans-serif" font-size="20">It contains no image tag, embedded bitmap or font dependency.</text>
</svg>`
}

function iconComparisonBoard(reference, vector) {
  const ref = dataUrl(reference)
  const drawn = dataUrl(vector)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#F7F8FC"/>
  <rect x="48" y="48" width="1104" height="664" rx="24" fill="#FFFFFF" stroke="#D9DEEA"/>
  <text x="96" y="120" fill="#1D2433" font-family="Arial, sans-serif" font-size="34" font-weight="700">APP ICON / REFERENCE VS VECTOR</text>
  <text x="96" y="162" fill="#667085" font-family="Arial, sans-serif" font-size="20">Supplied PNG, path-based SVG, and a 50% overlay.</text>
  <text x="96" y="222" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">SUPPLIED PNG</text>
  <text x="444" y="222" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">TRUE VECTOR SVG</text>
  <text x="792" y="222" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">OVERLAY</text>
  <image href="${ref}" x="96" y="252" width="300" height="300" preserveAspectRatio="none"/>
  <image href="${drawn}" x="444" y="252" width="300" height="300" preserveAspectRatio="none"/>
  <image href="${ref}" x="792" y="252" width="300" height="300" preserveAspectRatio="none"/>
  <image href="${drawn}" x="792" y="252" width="300" height="300" opacity=".5" preserveAspectRatio="none"/>
  <text x="96" y="620" fill="#667085" font-family="Arial, sans-serif" font-size="20">Vector source contains only rect, path, circle and gradient.</text>
</svg>`
}

async function main() {
  const referencePath = path.join(referenceRoot, 'logo-gallae-reference.png')
  const vectorPath = path.join(root, 'logo-gallae-reference-vector.svg')
  const reference = await sharp(referencePath).resize(1024, 571).flatten({ background: '#FFFFFF' }).png().toBuffer()
  const vector = await sharp(vectorPath).resize(1024, 571).flatten({ background: '#FFFFFF' }).png().toBuffer()
  const board = comparisonBoard(reference, vector)

  write(path.join(root, 'logo-gallae-reference-comparison.svg'), board)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, 'logo-gallae-reference-comparison.png'))
  write(path.join(root, 'logo-gallae-reference-vector.png'), vector)

  const referenceRaw = await sharp(reference).raw().toBuffer()
  const vectorRaw = await sharp(vector).raw().toBuffer()
  const logoMetrics = metrics(referenceRaw, vectorRaw)

  const iconReferencePath = path.join(referenceRoot, 'app-icon-reference.png')
  const iconVectorPath = path.join(root, 'app-icon-reference-vector.svg')
  const iconReference = await sharp(iconReferencePath).resize(446, 446).flatten({ background: '#FFFFFF' }).png().toBuffer()
  const iconVector = await sharp(iconVectorPath).resize(446, 446).flatten({ background: '#FFFFFF' }).png().toBuffer()
  const iconBoard = iconComparisonBoard(iconReference, iconVector)
  write(path.join(root, 'app-icon-reference-comparison.svg'), iconBoard)
  await sharp(Buffer.from(iconBoard)).png().toFile(path.join(root, 'app-icon-reference-comparison.png'))
  write(path.join(root, 'app-icon-reference-vector.png'), iconVector)

  const iconReferenceRaw = await sharp(iconReference).raw().toBuffer()
  const iconVectorRaw = await sharp(iconVector).raw().toBuffer()
  const iconMetrics = metrics(iconReferenceRaw, iconVectorRaw)
  write(path.join(root, 'comparison-metrics.json'), JSON.stringify({
    logo: { width: 1024, height: 571, ...logoMetrics },
    appIcon: { width: 446, height: 446, ...iconMetrics },
  }, null, 2) + '\n')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
