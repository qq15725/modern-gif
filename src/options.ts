import type { Frame, Gif } from './gif'

export type EncodeFrameOptions<T = CanvasImageSource | BufferSource | string> = Partial<Frame> & {
  /**
   * Frame image data
   */
  imageData: T
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
   * Max colors count 2-255
   */
  maxColors?: number
}

export type EncodeOptions<T = CanvasImageSource | BufferSource | string> = EncoderOptions & {
  frames: EncodeFrameOptions<T>[]
}

