import { readFrames } from './read-frames'
import type { GIF } from './gif'

export function readFrame(gifData: Uint8Array, gif: GIF, index: number): ImageData {
  return readFrames(gifData, gif, [0, Math.max(index, 0)]).pop()!
}
