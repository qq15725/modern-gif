import type { DecodedFrame } from './decode-frames'
import type { Gif } from './types'
import { decodeFrames } from './decode-frames'

export function decodeFrame(source: BufferSource, index: number, gif?: Gif): DecodedFrame {
  const frames = decodeFrames(source, {
    gif,
    range: [0, Math.max(index, 0)],
  })
  return frames.pop()!
}
