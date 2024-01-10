import type { Gif, UnencodedFrame } from './types'

export interface EncoderOptions extends Partial<Omit<Gif, 'width' | 'height' | 'frames'>> {
  /** GIF width */
  width: number
  /** GIF height */
  height: number
  /** The frames that needs to be encoded */
  frames?: Array<UnencodedFrame>
  /** Enable debug mode to view the execution time log */
  debug?: boolean
  /** Worker script url */
  workerUrl?: string
  /** Max colors count 2-255 */
  maxColors?: number
  /** Palette premultipliedAlpha */
  premultipliedAlpha?: boolean
  /** Palette tint */
  tint?: Array<number>
}
