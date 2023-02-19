import { decodeFrames } from './decode-frames'
import type { Gif } from './gif'

export function decodeFrame(gifData: Uint8Array, gif: Gif, index: number): ImageData {
  return decodeFrames(gifData, gif, [0, Math.max(index, 0)]).pop()!
}
