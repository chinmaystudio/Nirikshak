/*
 * Logo variant generator — derives ALL NIRIKSHAK logo assets from the single
 * provided brand file (stitch_nirikshan_project_monitoring_platform/image.png).
 * The artwork itself is never redrawn, stretched or regenerated: the emblem and
 * wordmark are passed through at their native aspect ratio; only recoloring
 * (dark-background variant) and crops (icon/favicon) are performed.
 *
 * Run: node scripts/process-logo.mjs
 */
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const SOURCE = path.join(repoRoot, 'stitch_nirikshan_project_monitoring_platform', 'image.png')
const OUT = path.join(repoRoot, 'frontend', 'public', 'logo')

fs.mkdirSync(OUT, { recursive: true })

async function main() {
  const meta = await sharp(SOURCE).metadata()
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`)

  // --- Trim transparent padding while preserving aspect ratio ---
  const trimmedBuf = await sharp(SOURCE).trim({ threshold: 8 }).toBuffer()
  const tMeta = await sharp(trimmedBuf).metadata()
  console.log(`Trimmed: ${tMeta.width}x${tMeta.height}`)

  // 1. Full logo — light-ink artwork on transparent background (headers, auth, footer on light)
  await sharp(trimmedBuf).png().toFile(path.join(OUT, 'nirikshak-logo.png'))

  // 2. Full logo — dark-canvas variant: invert luminance of the ink so the
  //    same artwork stays readable on dark surfaces (no distortion).
  await sharp(trimmedBuf).negate({ alpha: false }).png().toFile(path.join(OUT, 'nirikshak-logo-dark.png'))

  // 3. Compact emblem-only icon — crop to the square emblem region at the left.
  //    Emblem height ~= full height; square crop from the left edge.
  const side = Math.min(tMeta.width, tMeta.height)
  await sharp(trimmedBuf)
    .extract({ left: 0, top: 0, width: side, height: side })
    .resize(512, 512, { fit: 'inside' })
    .png()
    .toFile(path.join(OUT, 'nirikshak-icon.png'))

  // 4. Favicon (square, emblem centered on transparent ground)
  await sharp(path.join(OUT, 'nirikshak-icon.png'))
    .resize(64, 64, { fit: 'inside' })
    .png()
    .toFile(path.join(OUT, 'favicon-64.png'))

  // 5. Wordmark tile with soft light background — for use on stamps/cards where
  //    a transparent canvas would float (light surface guaranteed).
  await sharp(trimmedBuf)
    .flatten({ background: '#ffffff' })
    .extend({
      top: Math.round(tMeta.height * 0.12),
      bottom: Math.round(tMeta.height * 0.12),
      left: Math.round(tMeta.width * 0.04),
      right: Math.round(tMeta.width * 0.04),
      background: '#ffffff',
    })
    .png()
    .toFile(path.join(OUT, 'nirikshak-logo-card.png'))

  const files = fs.readdirSync(OUT)
  for (const f of files) {
    const m = await sharp(path.join(OUT, f)).metadata()
    console.log(`  ${f}: ${m.width}x${m.height}`)
  }
  console.log('Logo variants written to frontend/public/logo/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
