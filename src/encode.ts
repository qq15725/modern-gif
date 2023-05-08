import { createEncoder } from './create-encoder'
import type { EncodeOptions } from './options'

export function encode(options: EncodeOptions): Promise<Uint8Array> {
  const encoder = createEncoder(options)

  const { width, height, frames } = options

  frames.forEach(frameOptions => {
    encoder.encode({
      width,
      height,
      ...frameOptions,
    })
  })

  return encoder.flush()
}
