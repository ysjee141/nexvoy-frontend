const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const referenceRoot = path.join(root, 'reference')

function dataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function metric(reference, vector) {
  let changed = 0
  let total = 0
  for (let index = 0; index < reference.length; index += 3) {
    const delta = Math.abs(reference[index] - vector[index]) + Math.abs(reference[index + 1] - vector[index + 1]) + Math.abs(reference[index + 2] - vector[index + 2])
    total += delta
    if (delta > 24) changed += 1
  }
  return { changedPixelsOver24Delta: changed, totalAbsoluteRgbDelta: total }
}

async function compare(name, referenceFile, vectorFile, width, height) {
  const referencePng = await sharp(path.join(referenceRoot, referenceFile)).resize(width, height).flatten({ background: '#FFFFFF' }).png().toBuffer()
  const vectorPng = await sharp(path.join(root, vectorFile)).resize(width, height).flatten({ background: '#FFFFFF' }).png().toBuffer()
  const ref = dataUrl(referencePng)
  const vector = dataUrl(vectorPng)
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 3}" height="${height * 2}">
  <rect width="${width * 3}" height="${height * 2}" fill="#F7F8FC"/>
  <text x="24" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">REFERENCE</text>
  <text x="${width + 24}" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">TRUE VECTOR</text>
  <text x="${width * 2 + 24}" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">OVERLAY 50%</text>
  <image href="${ref}" x="0" y="48" width="${width}" height="${height}"/>
  <image href="${vector}" x="${width}" y="48" width="${width}" height="${height}"/>
  <image href="${ref}" x="${width * 2}" y="48" width="${width}" height="${height}"/>
  <image href="${vector}" x="${width * 2}" y="48" width="${width}" height="${height}" opacity=".5"/>
</svg>`
  fs.writeFileSync(path.join(root, `${name}-comparison.svg`), board)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, `${name}-comparison.png`))
  const referenceRaw = await sharp(referencePng).raw().toBuffer()
  const vectorRaw = await sharp(vectorPng).raw().toBuffer()
  return metric(referenceRaw, vectorRaw)
}

async function main() {
  const logo = await compare('logo-gallae-primary', 'primary-logo-reference.png', 'logo-gallae-primary.svg', 580, 330)
  const icon = await compare('app-icon-dark', 'app-icon-dark-reference.png', 'app-icon-dark.svg', 145, 145)
  fs.writeFileSync(path.join(root, 'comparison-metrics.json'), JSON.stringify({ logo, appIcon: icon }, null, 2) + '\n')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
