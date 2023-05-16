import { decode } from './decode'
import { mergeBuffers, resovleSource } from './utils'
import { lzwDecode } from './lzw-decode'
import { deinterlace } from './deinterlace'
import { createWorker } from './create-worker'
import type { Frame, Gif } from './gif'

export interface DecodedFrame {
  width: number
  height: number
  delay: number
  imageData: Uint8ClampedArray
}

export interface DecodeFramesOptions {
  gif?: Gif
  range?: number[]
}

export interface DecodeFramesInWorkerOptions extends DecodeFramesOptions {
  workerUrl: string
}

export function decodeFrames(source: BufferSource, options: DecodeFramesInWorkerOptions): Promise<DecodedFrame[]>
export function decodeFrames(source: BufferSource, options?: DecodeFramesOptions): DecodedFrame[]
export function decodeFrames(source: BufferSource, options?: DecodeFramesOptions | DecodeFramesInWorkerOptions): any {
  const array = resovleSource(source, 'uint8Array')

  if ((options as any)?.workerUrl) {
    return createWorker({ workerUrl: (options as any).workerUrl }).call(
      'frames:decode', array,
      [array.buffer],
    )
  }

  const {
    gif = decode(source),
    range,
  } = options ?? {}

  const {
    width: globalWidth,
    height: globalHeight,
    colorTable: globalColorTable,
    frames: globalFrames,
  } = gif

  const frames = range
    ? globalFrames.slice(range[0], range[1] + 1)
    : globalFrames

  const pixels = new Uint8ClampedArray(globalWidth * globalHeight * 4)
  let previousFrame: Frame | undefined

  return frames.map(frame => {
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
      disposal,
      delay,
    } = frame

    const bottom = top + height

    const {
      transparent,
      transparentIndex: transparentIndex_,
    } = graphicControl ?? {}

    const palette = localColorTable ? colorTable : globalColorTable
    const transparentIndex = transparent ? transparentIndex_ : -1

    const compressedData = mergeBuffers(
      imageDataPositions.map(
        ([begin, length]) => array.subarray(begin, begin + length),
      ),
    )

    let colorIndexes = lzwDecode(lzwMinCodeSize, compressedData, width * height)

    if (interlaced) {
      colorIndexes = deinterlace(colorIndexes, width)
    }

    if (previousFrame && previousFrame?.disposal !== 1) {
      const { left, top, width, height } = previousFrame
      const bottom = top + height
      for (let y = top; y < bottom; y++) {
        const globalOffset = y * globalWidth + left
        for (let x = 0; x < width; x++) {
          const index = (globalOffset + x) * 4
          pixels[index] = pixels[index + 1] = pixels[index + 2] = pixels[index + 3] = 0
        }
      }
    }

    for (let y = top; y < bottom; y++) {
      const globalOffset = y * globalWidth + left
      const localOffset = (y - top) * width
      for (let x = 0; x < width; x++) {
        const colorIndex = colorIndexes[localOffset + x]
        if (colorIndex === transparentIndex) continue
        const [r, g, b] = palette?.[colorIndex] ?? [0, 0, 0]
        const index = (globalOffset + x) * 4
        pixels[index] = r
        pixels[index + 1] = g
        pixels[index + 2] = b
        pixels[index + 3] = 255
      }
    }

    if (disposal !== 3) previousFrame = frame

    return {
      width: globalWidth,
      height: globalHeight,
      delay,
      imageData: pixels.slice(0),
    }
  })
}
