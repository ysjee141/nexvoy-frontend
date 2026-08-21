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

async function render(file, width, height) {
  return sharp(file).resize(width, height).flatten({ background: '#FFFFFF' }).png().toBuffer()
}

async function comparisonBoard(name, referenceFile, vectorFile, width, height) {
  const referencePng = await render(path.join(referenceRoot, referenceFile), width, height)
  const vectorPng = await render(path.join(root, vectorFile), width, height)
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 3}" height="${height + 48}" viewBox="0 0 ${width * 3} ${height + 48}"><rect width="${width * 3}" height="${height + 48}" fill="#F8FAFF"/><text x="24" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">REFERENCE</text><text x="${width + 24}" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">CLEAN VECTOR</text><text x="${width * 2 + 24}" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">OVERLAY 50%</text><image href="${dataUrl(referencePng)}" x="0" y="48" width="${width}" height="${height}"/><image href="${dataUrl(vectorPng)}" x="${width}" y="48" width="${width}" height="${height}"/><image href="${dataUrl(referencePng)}" x="${width * 2}" y="48" width="${width}" height="${height}"/><image href="${dataUrl(vectorPng)}" x="${width * 2}" y="48" width="${width}" height="${height}" opacity=".5"/></svg>`
  fs.writeFileSync(path.join(root, `${name}-comparison.svg`), board)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, `${name}-comparison.png`))
  const referenceRaw = await sharp(referencePng).raw().toBuffer()
  const vectorRaw = await sharp(vectorPng).raw().toBuffer()
  return metric(referenceRaw, vectorRaw)
}

async function main() {
  const boardReference = await render(path.join(referenceRoot, 'brand-system-reference.png'), 1254, 1254)
  const boardVector = await render(path.join(root, 'brand-system.svg'), 1254, 1254)
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="3762" height="1302" viewBox="0 0 3762 1302"><rect width="3762" height="1302" fill="#F8FAFF"/><text x="24" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">REFERENCE</text><text x="1278" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">REFERENCE SVG</text><text x="2532" y="30" font-family="Arial,sans-serif" font-size="22" fill="#1D2433">OVERLAY 50%</text><image href="${dataUrl(boardReference)}" x="0" y="48" width="1254" height="1254"/><image href="${dataUrl(boardVector)}" x="1254" y="48" width="1254" height="1254"/><image href="${dataUrl(boardReference)}" x="2508" y="48" width="1254" height="1254"/><image href="${dataUrl(boardVector)}" x="2508" y="48" width="1254" height="1254" opacity=".5"/></svg>`
  fs.writeFileSync(path.join(root, 'brand-system-comparison.svg'), board)
  await sharp(Buffer.from(board)).png().toFile(path.join(root, 'brand-system-comparison.png'))
  const boardReferenceRaw = await sharp(boardReference).raw().toBuffer()
  const boardVectorRaw = await sharp(boardVector).raw().toBuffer()

  const logo = await comparisonBoard('logo-gallae-primary', 'approved-primary-logo-reference.png', 'logo-gallae-primary.svg', 1024, 571)
  const icon = await comparisonBoard('app-icon-dark', 'approved-app-icon-reference.png', 'app-icon-dark.svg', 446, 446)
  fs.writeFileSync(path.join(root, 'comparison-metrics.json'), JSON.stringify({
    brandSystem: metric(boardReferenceRaw, boardVectorRaw),
    logo,
    appIcon: icon,
  }, null, 2) + '\n')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
