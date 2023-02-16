import { deinterlace } from './deinterlace'
import { readDataByLzw } from './read-data-by-lzw'
import type { GIF } from './gif'

export function readRawFrame(gifData: Uint8Array, gif: GIF, index: number): ImageData {
  const {
    width: gifWidth,
    height: gifHeight,
    frames,
    colorTable: globalColorTable,
  } = gif

  const frame = frames[index]

  if (!frame) {
    throw new Error(`This index ${ index } does not exist in frames`)
  }

  const {
    left,
    top,
    width,
    height,
    interlaced,
    localColorTable,
    colorTable,
    lzwMinCodeSize,
    imageDataPositions,
    graphicControl,
  } = frame

  const {
    transparent,
    transparentIndex,
  } = graphicControl ?? {}

  // merge sub-blocks
  const length = imageDataPositions.reduce((total, [, length]) => total + length, 0)
  const compressed = new Uint8Array(length)
  let offset = 0
  imageDataPositions.forEach(([begin, length]) => {
    const data = gifData.subarray(begin, begin + length)
    compressed.set(data, offset)
    offset += data.byteLength
  })

  // decompress image data
  let colorIndexes = readDataByLzw(lzwMinCodeSize, compressed, width * height)

  // deinterlace
  if (interlaced) {
    colorIndexes = deinterlace(colorIndexes, width)
  }

  const image = new ImageData(gifWidth, gifHeight)

  // color indexes to pixels
  const colors = localColorTable ? colorTable : globalColorTable
  colorIndexes.forEach((colorIndex, i) => {
    if (transparent && colorIndex === transparentIndex) return
    const [r, g, b] = colors?.[colorIndex] ?? [0, 0, 0]

    const y = top + Math.floor(i / width)
    const x = left + (i % width)
    const pos = y * gifWidth + x
    const index = pos * 4

    image.data[index] = r
    image.data[index + 1] = g
    image.data[index + 2] = b
    image.data[index + 3] = 255
  })

  return image
}
