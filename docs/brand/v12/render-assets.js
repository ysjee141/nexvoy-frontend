const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const outputRoot = path.join(root, 'png')
const assets = {
  primary: ['logo-gallae-primary.svg', 1024, 571],
  vertical: ['logo-gallae-vertical.svg', 520, 360],
  horizontal: ['logo-gallae-horizontal.svg', 780, 400],
  symbol: ['route-symbol.svg', 950, 270],
  light: ['app-icon-light.svg', 446, 446],
  dark: ['app-icon-dark.svg', 446, 446],
  coral: ['app-icon-coral.svg', 446, 446],
  outline: ['app-icon-outline.svg', 446, 446],
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true })
  for (const [name, [file, width, height]] of Object.entries(assets)) {
    await sharp(path.join(root, file))
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outputRoot, `${name}-${width}x${height}.png`))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
