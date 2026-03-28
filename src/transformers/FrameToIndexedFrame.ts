import type { QuantizedColor, Rgb } from 'modern-palette'
import type { EncoderConfig } from '../Encoder'
import type { DitherMethod, EncodingFrame } from '../types'
import { Finder } from 'modern-palette'

const ditherKernels: Record<DitherMethod, [number, number, number][]> = {
  'floyd-steinberg': [
    [7 / 16, 1, 0],
    [3 / 16, -1, 1],
    [5 / 16, 0, 1],
    [1 / 16, 1, 1],
  ],
  'atkinson': [
    [1 / 8, 1, 0],
    [1 / 8, 2, 0],
    [1 / 8, -1, 1],
    [1 / 8, 0, 1],
    [1 / 8, 1, 1],
    [1 / 8, 0, 2],
  ],
  'stucki': [
    [8 / 42, 1, 0],
    [4 / 42, 2, 0],
    [2 / 42, -2, 1],
    [4 / 42, -1, 1],
    [8 / 42, 0, 1],
    [4 / 42, 1, 1],
    [2 / 42, 2, 1],
    [1 / 42, -2, 2],
    [2 / 42, -1, 2],
    [4 / 42, 0, 2],
    [2 / 42, 1, 2],
    [1 / 42, 2, 2],
  ],
}

export class FrameToIndexedFrame implements ReadableWritablePair<EncodingFrame, EncodingFrame> {
  protected _rsControler!: ReadableStreamDefaultController<EncodingFrame>
  protected _finder: Finder
  protected _colors: Array<QuantizedColor>

  constructor(
    protected _config: EncoderConfig,
    colors: Array<QuantizedColor>,
  ) {
    this._finder = new Finder(colors, _config.premultipliedAlpha, _config.tint)
    this._colors = colors
  }

  readable = new ReadableStream<EncodingFrame>({
    start: controler => this._rsControler = controler,
  })

  writable = new WritableStream<EncodingFrame>({
    write: (frame) => {
      const transparentIndex = this._config.backgroundColorIndex
      const pixels = frame.data

      if (frame.width && frame.height && (this._config.dither || this._config.ditherTransparency)) {
        const pos = (x: number, y: number, c: 0 | 1 | 2 | 3): number => (y * frame.width! + x) * 4 + c

        if (this._config.dither) {
          const kernel = ditherKernels[this._config.dither]
          for (let y = 0; y < frame.height; y++) {
            for (let x = 0; x < frame.width; x++) {
              const p = pos(x, y, 0)
              const oldRGB: Rgb = {
                r: pixels[p],
                g: pixels[p + 1],
                b: pixels[p + 2],
              }
              const newRGB = this._colors[this._finder.findNearestIndex(
                oldRGB.r,
                oldRGB.g,
                oldRGB.b,
                this._config.premultipliedAlpha ? pixels[p + 3] : 255,
              )]!.rgb
              const error: Rgb = {
                r: oldRGB.r - newRGB.r,
                g: oldRGB.g - newRGB.g,
                b: oldRGB.b - newRGB.b,
              }
              pixels[p] = newRGB.r
              pixels[p + 1] = newRGB.g
              pixels[p + 2] = newRGB.b
              for (const [weight, xOffset, yOffset] of kernel) {
                const xCheck = (xOffset < 0) ? (x + xOffset >= 0) : (x + xOffset < frame.width)
                const yCheck = (yOffset < 0) ? (y + yOffset >= 0) : (y + yOffset < frame.height)
                if (xCheck && yCheck) {
                  const p = pos(x + xOffset, y + yOffset, 0)
                  pixels[p] += error.r * weight
                  pixels[p + 1] += error.g * weight
                  pixels[p + 2] += error.b * weight
                }
              }
            }
          }
        }

        if (this._config.ditherTransparency) {
          const kernel = ditherKernels[this._config.ditherTransparency]
          for (let y = 0; y < frame.height; y++) {
            for (let x = 0; x < frame.width; x++) {
              const p = pos(x, y, 3)
              const oldAlpha = pixels[p]
              const newAlpha = oldAlpha < 128 ? 0 : 255
              const error = oldAlpha - newAlpha
              pixels[p] = newAlpha
              for (const [weight, xOffset, yOffset] of kernel) {
                const xCheck = (xOffset < 0) ? (x + xOffset >= 0) : (x + xOffset < frame.width)
                const yCheck = (yOffset < 0) ? (y + yOffset >= 0) : (y + yOffset < frame.height)
                if (xCheck && yCheck) {
                  const p = pos(x + xOffset, y + yOffset, 3)
                  pixels[p] += error * weight
                }
              }
            }
          }
        }
      }

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
