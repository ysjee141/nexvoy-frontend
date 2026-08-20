const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const referenceRoot = path.join(root, 'reference')
const pngRoot = path.join(root, 'png')

const logoReference = path.join(referenceRoot, 'logo-gallae-reference.png')
const iconReference = path.join(referenceRoot, 'app-icon-reference.png')

function dataUrl(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

function imageSvg({ title, description, width, height, href }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${description}</desc>
  <image href="${href}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>
</svg>`
}

function brandSystem(logo, icon) {
  const logoHref = dataUrl(logo, 'image/png')
  const iconHref = dataUrl(icon, 'image/png')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#F7F8FC"/>
  <rect x="56" y="56" width="1488" height="888" rx="24" fill="#FFFFFF" stroke="#D9DEEA"/>
  <text x="104" y="126" fill="#1D2433" font-family="Arial, sans-serif" font-size="34" font-weight="700">갈래 BRAND SYSTEM / v10</text>
  <text x="104" y="168" fill="#667085" font-family="Arial, sans-serif" font-size="20">Reference-locked primary wordmark and app icon.</text>
  <line x1="104" y1="208" x2="1496" y2="208" stroke="#D9DEEA"/>
  <text x="104" y="266" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">PRIMARY WORDMARK / EXACT REFERENCE</text>
  <rect x="104" y="296" width="1020" height="572" rx="18" fill="#FFFFFF" stroke="#D9DEEA"/>
  <image href="${logoHref}" x="104" y="296" width="1020" height="570" preserveAspectRatio="none"/>
  <text x="1190" y="266" fill="#1D2433" font-family="Arial, sans-serif" font-size="22" font-weight="700">APP ICON / EXACT REFERENCE</text>
  <image href="${iconHref}" x="1190" y="304" width="306" height="306" preserveAspectRatio="none"/>
  <text x="1190" y="674" fill="#667085" font-family="Arial, sans-serif" font-size="20">reference PNG preserved as supplied</text>
  <text x="104" y="914" fill="#667085" font-family="Arial, sans-serif" font-size="20">No font substitution. No geometric reinterpretation. Use the supplied reference as the primary visual source.</text>
</svg>`
}

async function main() {
  const logoMetadata = await sharp(logoReference).metadata()
  const iconMetadata = await sharp(iconReference).metadata()
  const logoHref = dataUrl(logoReference, 'image/png')
  const iconHref = dataUrl(iconReference, 'image/png')

  const logoSvg = imageSvg({
    title: '갈래',
    description: '제공된 레퍼런스와 동일한 갈래 물음표 워드마크',
    width: logoMetadata.width,
    height: logoMetadata.height,
    href: logoHref,
  })
  const iconSvg = imageSvg({
    title: '갈래 앱 아이콘',
    description: '제공된 레퍼런스와 동일한 앱 아이콘',
    width: iconMetadata.width,
    height: iconMetadata.height,
    href: iconHref,
  })

  write(path.join(root, 'logo-gallae-question.svg'), logoSvg)
  write(path.join(root, 'logo-gallae-reference-wrapper.svg'), logoSvg)
  write(path.join(root, 'app-icon.svg'), iconSvg)
  write(path.join(root, 'logo-gallae-question-mono-dark.svg'), logoSvg)
  write(path.join(root, 'logo-gallae-question-mono-light.svg'), logoSvg)
  write(path.join(root, 'app-icon-preview.svg'), iconSvg)

  await sharp(logoReference).resize({ width: 1600 }).png().toFile(path.join(pngRoot, 'logo-gallae-question-reference-1600.png'))
  await sharp(logoReference).resize({ width: 1600 }).png().toFile(path.join(pngRoot, 'logo-gallae-reference-1600.png'))
  await sharp(iconReference).resize(1024, 1024).png().toFile(path.join(pngRoot, 'app-icon-reference-1024.png'))
  await sharp(iconReference).resize(512, 512).png().toFile(path.join(pngRoot, 'app-icon-reference-512.png'))
  await sharp(iconReference).resize(192, 192).png().toFile(path.join(pngRoot, 'app-icon-reference-192.png'))
  await sharp(iconReference).resize(64, 64).png().toFile(path.join(pngRoot, 'app-icon-reference-64.png'))
  await sharp(iconReference).resize(32, 32).png().toFile(path.join(pngRoot, 'app-icon-reference-32.png'))
  await sharp(iconReference).resize(16, 16).png().toFile(path.join(pngRoot, 'app-icon-reference-16.png'))
  await sharp(Buffer.from(brandSystem(logoReference, iconReference))).png().toFile(path.join(root, 'brand-system.png'))
  write(path.join(root, 'brand-system.svg'), brandSystem(logoReference, iconReference))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
