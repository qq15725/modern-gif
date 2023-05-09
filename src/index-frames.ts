import { createColorFinder } from 'modern-palette'

import type { Context, Palette } from 'modern-palette'

export interface IndexFramesOptions {
  frames: { imageData: Uint8ClampedArray }[]
  palette: Palette | Context
  transparentIndex: number
}

export function indexFrames(options: IndexFramesOptions) {
  const {
    frames,
    palette,
    transparentIndex,
  } = options

  const find = createColorFinder(palette)

  return frames.map(({ imageData: pixels }) => {
    let transparent = false
    const indexedPixels = new Uint8ClampedArray(pixels.length / 4)
    for (let len = pixels.length, i = 0; i < len; i += 4) {
      if (pixels[i + 3] === 0) {
        indexedPixels[i / 4] = transparentIndex
        transparent = true
      } else {
        indexedPixels[i / 4] = find(
          (pixels[i] << 16)
          | (pixels[i + 1] << 8)
          | pixels[i + 2],
        )
      }
    }
    return {
      imageData: indexedPixels,
      transparent,
    }
  })
}
