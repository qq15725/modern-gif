import { decodeFrameButUndisposed } from './decode-frame-but-undisposed'
import type { Frame, GIF } from './gif'

export function decodeFrames(gifData: Uint8Array, gif: GIF, range?: number[]): ImageData[] {
  const { frames, width: gifWidth, height: gifHeight } = gif
  const rangeFrames = range ? frames.slice(range[0], range[1] + 1) : frames
  const pixels = new Uint8ClampedArray(gifWidth * gifHeight * 4)
  let previousFrame: Frame | undefined

  function getRange(frame: Frame) {
    const { left, top, width, height } = frame
    const start = (top * gifWidth + left) * 4
    const end = ((top + height) * gifWidth + (left + width)) * 4
    return { start, end }
  }

  return rangeFrames.map(frame => {
    const { index, disposal } = frame
    const image = decodeFrameButUndisposed(gifData, gif, index)

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

    return new ImageData(pixels.slice(0), gifWidth, gifHeight)
  })
}
