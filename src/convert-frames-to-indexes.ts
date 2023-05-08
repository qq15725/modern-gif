import { createColorFinder } from 'modern-palette'

import type { Palette } from 'modern-palette'
import type { EncodeFrameOptions } from './options'

export function convertFramesToIndexes(
  frames: EncodeFrameOptions[],
  palette: Palette,
  transparentIndex: number,
) {
  const findNearestColor = createColorFinder(palette)
  const transparents: boolean[] = []

  return {
    allIndexes: frames.map((frame, index) => {
      const { imageData } = frame
      const indexes = new Uint8Array(imageData.length / 4)
      for (let len = imageData.length, i = 0; i < len; i += 4) {
        if (imageData[i + 3] === 0) {
          indexes[i / 4] = transparentIndex
          transparents[index] = true
        } else {
          indexes[i / 4] = findNearestColor(
            (imageData[i] << 16)
            | (imageData[i + 1] << 8)
            | imageData[i + 2],
          )
        }
      }
      return indexes
    }),
    transparents,
  }
}
