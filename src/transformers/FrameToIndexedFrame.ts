import type { QuantizedColor } from 'modern-palette'
import type { EncoderConfig } from '../Encoder'
import type { EncodingFrame } from '../types'
import { Finder } from 'modern-palette'

export class FrameToIndexedFrame implements ReadableWritablePair<EncodingFrame, EncodingFrame> {
  protected _rsControler!: ReadableStreamDefaultController<EncodingFrame>
  protected _finder: Finder

  constructor(
    protected _config: EncoderConfig,
    colors: Array<QuantizedColor>,
  ) {
    this._finder = new Finder(colors, _config.premultipliedAlpha, _config.tint)
  }

  readable = new ReadableStream<EncodingFrame>({
    start: controler => this._rsControler = controler,
  })

  writable = new WritableStream<EncodingFrame>({
    write: (frame) => {
      const transparentIndex = this._config.backgroundColorIndex
      const pixels = frame.data
      let transparent = false
      const indexes = new Uint8ClampedArray(pixels.length / 4)
      for (let len = pixels.length, i = 0; i < len; i += 4) {
        if (pixels[i + 3] === 0) {
          indexes[i / 4] = transparentIndex
          transparent = true
        }
        else {
          indexes[i / 4] = this._finder.findNearestIndex(
            pixels[i],
            pixels[i + 1],
            pixels[i + 2],
            pixels[i + 3],
          )
        }
      }
      this._rsControler.enqueue({
        ...frame,
        data: indexes,
        transparent,
      })
    },
    close: () => {
      this._rsControler.close()
    },
  })
}
