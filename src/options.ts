import type { Frame, Gif } from './gif'

export type EncodeFrameOptions = Partial<Frame> & {
  /**
   * Frame image data
   */
  imageData: Uint8ClampedArray
}

export type EncoderOptions = Omit<Partial<Gif>, 'frames'> & {
  /**
   * Enable debug mode to view the execution time log.
   */
  debug?: boolean

  /**
   * Worker script url
   */
  workerUrl?: string

  /**
   * Worker number
   */
  workerNumber?: number

  /**
   * Max colors count
   */
  maxColors?: number
}

export type EncodeOptions = EncoderOptions & {
  frames: EncodeFrameOptions[]
}

