import { lzwDecode } from './lzw'
import { deinterlace } from './deinterlace'
import type { GIF } from './types'

export function readFrame(dataView: Uint8Array, gif: GIF, index: number): ImageData {
  const frame = gif.frames[index]
  if (!frame) {
    throw new Error(`This index is abnormal. index: ${ index }`)
  }
  const {
    imageData,
    width,
    height,
    colors = gif.colors,
    minCodeSize,
    interlaced,
  } = frame
  const imageDataView = new Uint8Array(
    imageData.reduce((total, [, length]) => total + length, 0),
  )
  let offset = 0
  imageData.forEach(([begin, length]) => {
    const subBlockView = dataView.subarray(begin, begin + length)
    imageDataView.set(subBlockView, offset)
    offset += subBlockView.byteLength
  })
  let indexes = lzwDecode(minCodeSize, imageDataView, width * height)
  if (interlaced) {
    indexes = deinterlace(indexes, width)
  }
  const pixels = new Uint8ClampedArray(width * height * 4)
  indexes.forEach((colorIndex, index) => {
    const color = colors?.[colorIndex] ?? [0, 0, 0]
    index *= 4
    pixels[index] = color[0]
    pixels[index + 1] = color[1]
    pixels[index + 2] = color[2]
    pixels[index + 3] = colorIndex === frame.graphicControl?.transparentIndex ? 0 : 255
  })
  return new ImageData(pixels, width, height)
}
