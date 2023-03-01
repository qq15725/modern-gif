import { decode } from './decode'
import { decodeFrameButUndisposed } from './decode-frame-but-undisposed'
import { SUPPORT_IMAGE_DECODER } from './utils'
import type { Frame, Gif, GifBuffer } from './gif'

export interface DecodedFrame {
  width: number
  height: number
  delay: number
  data: Uint8ClampedArray
}

export async function decodeFrames(
  data: GifBuffer,
  options: {
    gif?: Gif
    frameIndexes?: number[]
  } = {},
): Promise<DecodedFrame[]> {
  const { frameIndexes } = options

  if (SUPPORT_IMAGE_DECODER && await ImageDecoder.isTypeSupported('image/gif')) {
    const decoder = new ImageDecoder({ data, type: 'image/gif' })
    await decoder.completed
    await decoder.tracks.ready
    const track = decoder.tracks.selectedTrack
    if (track) {
      const allFrameIndexes = [...new Array(track.frameCount)].map((_, frameIndex) => frameIndex)
      const frames = await Promise.all(
        (frameIndexes ? allFrameIndexes.slice(frameIndexes[0], frameIndexes[1] + 1) : allFrameIndexes)
          .map(
            frameIndex => decoder.decode({ frameIndex }).then(res => {
              const frame = res.image
              const canvas = document.createElement('canvas')
              canvas.width = frame.displayWidth
              canvas.height = frame.displayHeight
              const context2d = canvas.getContext('2d')!
              context2d.drawImage(frame, 0, 0)
              const imageData = context2d.getImageData(0, 0, canvas.width, canvas.height)
              return {
                width: frame.displayWidth,
                height: frame.displayHeight,
                delay: (frame.duration ?? 100_0000) / 1_000,
                data: imageData.data,
              }
            }),
          ),
      )
      decoder.close()
      return frames
    }
  }

  const { gif = decode(data) } = options
  const { frames, width: gifWidth, height: gifHeight } = gif
  const rangeFrames = frameIndexes ? frames.slice(frameIndexes[0], frameIndexes[1] + 1) : frames
  const pixels = new Uint8ClampedArray(gifWidth * gifHeight * 4)
  let previousFrame: Frame | undefined

  function getRange(frame: Frame) {
    const { left, top, width, height } = frame
    const start = (top * gifWidth + left) * 4
    const end = ((top + height) * gifWidth + (left + width)) * 4
    return { start, end }
  }

  let uint8Array: Uint8Array
  if (data instanceof ArrayBuffer) {
    uint8Array = new Uint8Array(data)
  } else if (data instanceof Uint8Array) {
    uint8Array = data
  } else {
    uint8Array = new Uint8Array(data.buffer)
  }

  return rangeFrames.map(frame => {
    const { index, disposal } = frame
    const image = decodeFrameButUndisposed(uint8Array, gif, index)

    if (previousFrame && previousFrame?.disposal !== 1) {
      const { left, top, width, height } = previousFrame
      const { start, end } = getRange(previousFrame)
      for (let i = start; i < end; i += 4) {
        const p = i / 4
        const cy = p / gifWidth
        const cx = p % gifWidth
        if (cx >= left && cx < left + width && cy >= top && cy < top + height) {
          pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = 0
        }
      }
    }

    const { start, end } = getRange(frame)

    for (let i = start; i < end; i += 4) {
      if (image.data[i + 3] !== 0) {
        pixels[i] = image.data[i]
        pixels[i + 1] = image.data[i + 1]
        pixels[i + 2] = image.data[i + 2]
        pixels[i + 3] = image.data[i + 3]
      }
    }

    if (disposal !== 3) {
      previousFrame = frame
    }

    return {
      width: gifWidth,
      height: gifHeight,
      delay: frame.delay,
      data: pixels.slice(0),
    }
  })
}
