import { Finder } from 'modern-palette'
import type { Frame } from '../types'
import type { QuantizedColor } from 'modern-palette'

export type IndexFramesInput = Partial<Frame> & { data: ArrayLike<number> }

export type IndexFramesOutput = Partial<Frame> & { data: ArrayLike<number> } & { transparent: boolean }

export class FrameToIndexedFrame implements ReadableWritablePair<IndexFramesOutput, IndexFramesInput> {
  protected _rsControler!: ReadableStreamDefaultController<IndexFramesOutput>
  protected _finder: Finder

  constructor(
    public transparentIndex: number,
    premultipliedAlpha: boolean,
    tint: Array<number>,
    colors: Array<QuantizedColor>,
  ) {
    this._finder = new Finder(colors, premultipliedAlpha, tint)
  }

  readable = new ReadableStream<IndexFramesOutput>({
    start: controler => this._rsControler = controler,
  })

  writable = new WritableStream<IndexFramesInput>({
    write: (frame) => {
      const transparentIndex = this.transparentIndex
      const pixels = frame.data
      let transparent = false
      const indexes = new Uint8ClampedArray(pixels.length / 4)
      for (let len = pixels.length, i = 0; i < len; i += 4) {
        if (pixels[i + 3] === 0) {
          indexes[i / 4] = transparentIndex
          transparent = true
        } else {
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
