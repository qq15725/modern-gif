import { readFrame } from './read-frame'
import type { GIF } from './types'

export function readFrames(dataView: Uint8Array, gif: GIF): ImageData[] {
  return gif.frames.map((_, index) => readFrame(dataView, gif, index))
}
