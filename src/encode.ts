import { createEncoder } from './create-encoder'
import type { EncodeOptions } from './options'

export async function encode(options: EncodeOptions): Promise<Uint8Array> {
  const { frames } = options

  const encoder = createEncoder(options)

  for (let len = frames.length, i = 0; i < len; i++) {
    await encoder.encode(frames[i])
  }

  return await encoder.flush()
}
