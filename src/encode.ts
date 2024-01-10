import { Encoder } from './Encoder'
import type { EncoderOptions } from './types'

export function encode(options: EncoderOptions & { format: 'blob' }): Promise<Blob>
export function encode(options: EncoderOptions & { format?: 'arrayBuffer' }): Promise<ArrayBuffer>
export function encode(options: EncoderOptions & { format?: string }): Promise<any> {
  return new Encoder(options).flush(options.format as any)
}
