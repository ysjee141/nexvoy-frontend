const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const reference = path.join(root, 'reference', 'brand-system-reference.png')
const pngOutput = path.join(root, 'brand-system.png')
const svgOutput = path.join(root, 'brand-system.svg')

function dataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

async function main() {
  const source = fs.readFileSync(reference)
  const metadata = await sharp(source).metadata()
  const width = metadata.width
  const height = metadata.height
  fs.copyFileSync(reference, pngOutput)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">갈래 Brand System v12 reference board</title><desc id="desc">사용자 제공 브랜드 시스템 raster를 픽셀 그대로 보존한 문서용 reference board. 제품 로고와 앱 아이콘은 별도 true-vector 자산을 사용한다.</desc><image href="${dataUrl(source)}" x="0" y="0" width="${width}" height="${height}"/></svg>\n`
  fs.writeFileSync(svgOutput, svg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
