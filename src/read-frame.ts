import { lzwDecode } from './lzw'
import { deinterlace } from './deinterlace'
import type { GIF } from './types'

export function readFrame(gifData: Uint8Array, gif: GIF, index: number): ImageData {
  const { frames, colorTable: globalColorTable } = gif

  const frame = frames[index]

  if (!frame) {
    throw new Error(`This index ${ index } does not exist in frames`)
  }

  const {
    width,
    height,
    interlaced,
    colorTable = globalColorTable,
    lzwMinCodeSize,
    imageDataPositions,
    graphicControl,
  } = frame

  const size = width * height

  const { transparentIndex = 0 } = graphicControl ?? {}

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
  let colorIndexes = lzwDecode(lzwMinCodeSize, compressed, size)

  // deinterlace
  if (interlaced) {
    colorIndexes = deinterlace(colorIndexes, width)
  }

  // color indexes to pixels
  const pixels = new Uint8ClampedArray(size * 4)
  colorIndexes.forEach((colorIndex, index) => {
    const color = colorTable?.[colorIndex] ?? [0, 0, 0]
    index *= 4
    pixels[index] = color[0]
    pixels[index + 1] = color[1]
    pixels[index + 2] = color[2]
    pixels[index + 3] = colorIndex === transparentIndex ? 0 : 255
  })

  return new ImageData(pixels, width, height)
}
