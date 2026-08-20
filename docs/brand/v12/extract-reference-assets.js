const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const referenceRoot = path.join(root, 'reference')
const source = process.env.GALLAE_BRAND_REFERENCE || path.join(referenceRoot, 'brand-system-reference.png')

const crops = {
  'primary-logo': { left: 340, top: 80, width: 580, height: 330 },
  'logo-vertical': { left: 105, top: 510, width: 300, height: 190 },
  'logo-horizontal': { left: 450, top: 525, width: 390, height: 185 },
  'route-symbol': { left: 875, top: 565, width: 290, height: 150 },
  'app-icon-light': { left: 115, top: 860, width: 145, height: 145 },
  'app-icon-dark': { left: 268, top: 860, width: 145, height: 145 },
  'app-icon-coral': { left: 422, top: 860, width: 145, height: 145 },
  'app-icon-outline': { left: 576, top: 860, width: 145, height: 145 },
}

async function main() {
  fs.mkdirSync(referenceRoot, { recursive: true })
  for (const [name, extract] of Object.entries(crops)) {
    await sharp(source)
      .extract(extract)
      .png()
      .toFile(path.join(referenceRoot, `${name}-reference.png`))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
