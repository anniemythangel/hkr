import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(scriptDir, '..')
const source = resolve(clientRoot, 'assets/icon.svg')
const outputDir = resolve(clientRoot, 'public/icons')

await mkdir(outputDir, { recursive: true })

async function renderIcon(filename, size, options = {}) {
  const inset = options.inset ?? 0
  const contentSize = size - inset * 2
  const icon = await sharp(source).resize(contentSize, contentSize).png().toBuffer()
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#050b0a',
    },
  })
  await canvas
    .composite([{ input: icon, left: inset, top: inset }])
    .png()
    .toFile(resolve(outputDir, filename))
}

await Promise.all([
  renderIcon('pwa-192.png', 192),
  renderIcon('pwa-512.png', 512),
  renderIcon('maskable-512.png', 512, { inset: 51 }),
  renderIcon('apple-touch-icon.png', 180),
])

console.log(`Generated PWA icons in ${outputDir}`)
