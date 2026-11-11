// Writes every icon from the one mark in src/assets/mark.mjs: run `node scripts/make-icons.mjs` after changing the mark.
// icon.svg (true circle, transparent corners), favicon.ico (16, 32, 48), 32/192/512 PNGs, a full-bleed 180 apple-touch icon,
// and a maskable 512 whose mark stays inside Android's safe zone (the central circle of 80% diameter).
import fs from 'node:fs'

import { chromium } from '@playwright/test'

import { ICON_SVG, squareSvg } from '../src/assets/mark.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
async function png(svg, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block}</style><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`)
  await page.locator('img').evaluate(img => img.decode())
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

/** An .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(([size, data], i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e)
    head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...images.map(([, d]) => d)])
}

fs.mkdirSync('public/icons', { recursive: true })
fs.writeFileSync('src/app/icon.svg', `${ICON_SVG}\n`)
fs.writeFileSync('src/app/favicon.ico', ico([[16, await png(ICON_SVG, 16)], [32, await png(ICON_SVG, 32)], [48, await png(ICON_SVG, 48)]]))
for (const size of [32, 192, 512]) fs.writeFileSync(`public/icons/icon-${size}.png`, await png(ICON_SVG, size))
fs.writeFileSync('src/app/apple-icon.png', await png(squareSvg(0.78), 180))
// Safe zone: a circle of radius 0.4 x size. The mark spans about 44 of 64 units, so 0.66 keeps it well inside.
fs.writeFileSync('public/icons/maskable-512.png', await png(squareSvg(0.66), 512))
await browser.close()
console.log('icons written')
