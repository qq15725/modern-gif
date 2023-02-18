import { createEncoder } from './create-encoder'
import type { Frame, GIF } from './gif'

export function encode(gif: Partial<GIF>): Promise<Uint8Array> {
  const encoder = createEncoder(gif)

  gif.frames?.forEach(frame => {
    encoder.encode({
      width: gif?.width,
      height: gif?.height,
      colorTableGeneration: gif?.colorTableGeneration,
      ...(frame as Partial<Frame>),
    })
  })

  return encoder.flush()
}
