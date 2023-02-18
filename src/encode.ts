import { createEncoder } from './create-encoder'
import { encodeFrame } from './encode-frame'
import type { Frame, GIF } from './gif'

export function encode(gif: Partial<GIF>): Uint8Array {
  const encoder = createEncoder(gif)

  gif.frames?.forEach(frame => {
    encoder.write(
      encodeFrame({
        width: gif?.width,
        height: gif?.height,
        colorTableGeneration: gif?.colorTableGeneration,
        ...(frame as Partial<Frame>),
      }),
    )
  })

  return encoder.flush()
}
