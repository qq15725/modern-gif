import { decodeFrames } from './decode-frames'
import type { DecodedFrame } from './decode-frames'
import type { Gif, GifBuffer } from './gif'

export async function decodeFrame(data: GifBuffer, index: number, gif?: Gif): Promise<DecodedFrame> {
  const frames = await decodeFrames(data, {
    gif,
    frameIndexes: [0, Math.max(index, 0)],
  })
  return frames.pop()!
}
