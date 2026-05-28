import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const assets = [
  {
    jpeg: 'src/assets/cold-bg.jpeg',
    avif: 'src/assets/cold-bg.avif',
  },
  {
    jpeg: 'src/assets/warm-bg.jpeg',
    avif: 'src/assets/warm-bg.avif',
  },
]

const maxWidth = 1920
const maxJpegBytes = 800 * 1024
const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

for (const asset of assets) {
  const inputPath = path.resolve(asset.jpeg)
  const avifPath = path.resolve(asset.avif)
  const before = await stat(inputPath)
  const inputBuffer = await readFile(inputPath)
  const source = sharp(inputBuffer).rotate()
  const metadata = await source.metadata()
  const resized = source.resize({
    width: maxWidth,
    withoutEnlargement: true,
  })
  const shouldRewriteJpeg = (metadata.width ?? 0) > maxWidth || before.size > maxJpegBytes

  const jpegBuffer = shouldRewriteJpeg
    ? await resized
        .clone()
        .jpeg({
          quality: 76,
          mozjpeg: true,
        })
        .toBuffer()
    : inputBuffer

  const avifBuffer = await sharp(jpegBuffer)
    .clone()
    .avif({
      quality: 45,
      effort: 6,
    })
    .toBuffer()

  if (shouldRewriteJpeg) {
    await writeFile(inputPath, jpegBuffer)
  }

  await writeFile(avifPath, avifBuffer)

  const after = await stat(inputPath)

  console.log(
    `${asset.jpeg}: ${metadata.width}x${metadata.height}, ${formatBytes(before.size)} -> ${formatBytes(after.size)} jpeg, ${formatBytes(avifBuffer.length)} avif`,
  )
}
