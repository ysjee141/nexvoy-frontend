const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const referenceRoot = path.join(root, 'reference')
const outputRoot = path.join(root, 'trace-inputs')
const palette = {
  navy: [13, 35, 64],
  coral: [255, 107, 92],
  white: [255, 255, 255],
}

const inputs = [
  'primary-logo',
  'logo-vertical',
  'logo-horizontal',
  'route-symbol',
  'app-icon-light',
  'app-icon-dark',
  'app-icon-coral',
  'app-icon-outline',
]

function distance(rgb, target) {
  return Math.sqrt(
    ((rgb[0] - target[0]) ** 2) +
    ((rgb[1] - target[1]) ** 2) +
    ((rgb[2] - target[2]) ** 2),
  )
}

function nearest(rgb) {
  const entries = Object.entries(palette)
  return entries.reduce((best, entry) => {
    const nextDistance = distance(rgb, entry[1])
    return nextDistance < best.distance ? { name: entry[0], distance: nextDistance } : best
  }, { name: 'white', distance: Number.POSITIVE_INFINITY })
}

function quantize(data, channels) {
  for (let index = 0; index < data.length; index += channels) {
    const rgb = [data[index], data[index + 1], data[index + 2]]
    const spread = Math.max(...rgb) - Math.min(...rgb)
    const average = (rgb[0] + rgb[1] + rgb[2]) / 3
    const match = spread < 34 && average > 150 ? { name: 'white' } : nearest(rgb)
    const color = palette[match.name]
    data[index] = color[0]
    data[index + 1] = color[1]
    data[index + 2] = color[2]
    if (channels === 4) data[index + 3] = 255
  }
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true })
  for (const name of inputs) {
    const { data, info } = await sharp(path.join(referenceRoot, `${name}-reference.png`))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    quantize(data, info.channels)
    await sharp(data, { raw: info }).png().toFile(path.join(outputRoot, `${name}-trace.png`))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
