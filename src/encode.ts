import type { EncoderOptions } from './options'
import { Encoder } from './Encoder'

export function encode(options: EncoderOptions & { format: 'blob' }): Promise<Blob>
export function encode(options: EncoderOptions & { format?: 'arrayBuffer' }): Promise<ArrayBuffer>
export function encode(options: EncoderOptions & { format?: string }): Promise<any> {
  return new Encoder(options).flush(options.format as any)
}
