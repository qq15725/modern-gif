import { deinterlace } from './deinterlace'
import { lzwDecode } from './lzw-decode'
import { mergeUint8Array, resovleUint8Array } from './utils'
import type { Gif } from './gif'

export function decodeUndisposedFrame(source: BufferSource, gif: Gif, index: number): Uint8ClampedArray {
  const uint8Array = resovleUint8Array(source)

  const {
    frames,
    colorTable: globalColorTable,
  } = gif

  const frame = frames[index]

  if (!frame) {
    throw new Error(`This index ${ index } does not exist in frames`)
  }

  const {
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
    transparentIndex: transparentIndex_,
  } = graphicControl ?? {}

  const palette = localColorTable ? colorTable : globalColorTable
  const transparentIndex = transparent ? transparentIndex_ : -1

  const compressedData = mergeUint8Array(
    ...imageDataPositions.map(
      ([begin, length]) => uint8Array.subarray(begin, begin + length),
    ),
  )

  let colorIndexes = lzwDecode(lzwMinCodeSize, compressedData, width * height)

  if (interlaced) {
    colorIndexes = deinterlace(colorIndexes, width)
  }

  const data = new Uint8ClampedArray(width * height * 4)
  for (let len = colorIndexes.length, i = 0; i < len; i++) {
    const colorIndex = colorIndexes[i]
    if (colorIndex === transparentIndex) continue
    const [r, g, b] = palette?.[colorIndex] ?? [0, 0, 0]
    const index = i * 4
    data[index] = r
    data[index + 1] = g
    data[index + 2] = b
    data[index + 3] = 255
  }
  return data
}
