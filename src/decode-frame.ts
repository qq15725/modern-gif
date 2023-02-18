import { decodeFrames } from './decode-frames'
import type { GIF } from './gif'

export function decodeFrame(gifData: Uint8Array, gif: GIF, index: number): ImageData {
  return decodeFrames(gifData, gif, [0, Math.max(index, 0)]).pop()!
}
