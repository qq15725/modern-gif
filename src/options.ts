import type { Frame, Gif } from './gif'

export type Algorithm = 'MMCQ' | 'NeuQuant'

export type EncodeFrameOptions = Partial<Frame> & {
  /**
   * Color table generation algorithm
   */
  algorithm?: Algorithm

  /**
   * Frame image data
   */
  imageData: Uint8ClampedArray
}

export type EncoderOptions = Omit<Partial<Gif>, 'frames'> & {
  /**
   * Color table generation algorithm
   */
  algorithm?: Algorithm

  /**
   * Worker script url
   */
  workerUrl?: string

  /**
   * Worker number
   */
  workerNumber?: number
}

export type EncodeOptions = EncoderOptions & {
  frames: EncodeFrameOptions[]
}

