import { Palette } from 'modern-palette'
import { Logger } from './Logger'
import { CropIndexedFrame, EncodeGif, EncodeIndexdFrame, FrameToIndexedFrame } from './transformers'
import { loadImage, resovleSource } from './utils'
import { createWorker } from './create-worker'
import type { Frame, Gif } from './types'

export interface EncoderOptions extends Partial<Omit<Gif, 'width' | 'height' | 'frames'>> {
  /**
   * GIF width
   */
  width: number

  /**
   * GIF height
   */
  height: number

  /**
   * The frames that needs to be encoded
   */
  frames?: Array<Partial<Frame> & { data: Uint8ClampedArray }>

  /**
   * Enable debug mode to view the execution time log.
   */
  debug?: boolean

  /**
   * Worker script url
   */
  workerUrl?: string

  /**
   * Max colors count 2-255
   */
  maxColors?: number

  /**
   * Palette premultipliedAlpha
   */
  premultipliedAlpha?: boolean

  /**
   * Palette tint
   */
  tint?: Array<number>
}

export interface EncoderConfig extends EncoderOptions {
  debug: boolean
  maxColors: number
  premultipliedAlpha: boolean
  tint: Array<number>
  colorTableSize: number
  backgroundColorIndex: number
}

export class Encoder {
  config: EncoderConfig
  logger: Logger
  frames: Array<Partial<Frame> & { data: Uint8ClampedArray }> = []
  palette: Palette
  protected _encodeId = 0
  protected _worker?: ReturnType<typeof createWorker>

  constructor(options: EncoderOptions) {
    this.config = this._resolveOptions(options)
    this.logger = new Logger(this.config.debug)
    this.palette = new Palette({
      maxColors: this.config.maxColors,
      premultipliedAlpha: this.config.premultipliedAlpha,
      tint: this.config.tint,
    })
    if (this.config.workerUrl) {
      this._worker = createWorker({ workerUrl: this.config.workerUrl })
      this._worker.call('encoder:init', options)
    } else {
      this.config.frames?.forEach(frame => {
        this.encode(frame)
      })
    }
  }

  protected _resolveOptions(options: EncoderOptions): EncoderConfig {
    (['width', 'height'] as const).forEach(key => {
      if (
        typeof options[key] !== 'undefined'
        && Math.floor(options[key]!) !== options[key]
      ) {
        console.warn(`${ key } cannot be a floating point number`)
        options[key] = Math.floor(options[key]!)
      }
    })

    const {
      colorTableSize = 256,
      backgroundColorIndex = colorTableSize - 1,
      maxColors = colorTableSize - 1,
      debug = false,
      premultipliedAlpha = false,
      tint = [0xFF, 0xFF, 0xFF],
    } = options

    return {
      ...options,
      colorTableSize,
      backgroundColorIndex,
      maxColors,
      debug,
      premultipliedAlpha,
      tint,
    }
  }

  async encode(frame: Partial<Frame> & { data: CanvasImageSource | BufferSource | string }): Promise<void> {
    if (this._worker) {
      let transfer: any | undefined
      if (ArrayBuffer.isView(frame.data)) {
        transfer = [frame.data.buffer]
      } else if (frame.data instanceof ArrayBuffer) {
        transfer = [frame.data]
      }
      return this._worker.call('encoder:encode', frame, transfer)
    }

    const _encodeId = this._encodeId
    this._encodeId++

    const {
      width: frameWidth = this.config.width,
      height: frameHeight = this.config.height,
    } = frame

    let { data } = frame

    try {
      this.logger.time(`palette:sample-${ _encodeId }`)
      data = typeof data === 'string'
        ? await loadImage(data)
        : data

      data = resovleSource(data, 'uint8ClampedArray', {
        width: frameWidth,
        height: frameHeight,
      })

      this.frames.push({
        ...frame,
        width: frameWidth,
        height: frameHeight,
        data: data as any,
      })

      this.palette.addSample(data)
    } finally {
      this.logger.timeEnd(`palette:sample-${ _encodeId }`)
    }
  }

  async flush(format: 'blob'): Promise<Blob>
  async flush(format?: 'arrayBuffer'): Promise<ArrayBuffer>
  async flush(format?: string): Promise<any> {
    if (this._worker) {
      return this._worker.call('encoder:flush', format)
    }

    this.logger.time('palette:generate')
    const colors = await this.palette.generate()
    this.logger.timeEnd('palette:generate')

    const colorTable = colors.map(color => [color.rgb.r, color.rgb.g, color.rgb.b])
    while (colorTable.length < this.config.colorTableSize) {
      colorTable.push([0, 0, 0])
    }

    this.logger.debug('palette:maxColors', this.config.maxColors)
    // eslint-disable-next-line no-console
    this.config.debug && console.debug(
      colors.map(() => '%c ').join(''),
      ...colors.map(color => `margin: 1px; background: ${ color.hex }`),
    )

    this.logger.time('encode')
    const output = await new Promise<Uint8Array>(resolve => {
      new ReadableStream({
        start: controller => {
          this.frames.forEach(frame => {
            controller.enqueue(frame)
          })
          controller.close()
        },
      })
        .pipeThrough(
          new FrameToIndexedFrame(
            this.config.backgroundColorIndex,
            this.config.premultipliedAlpha,
            this.config.tint,
            colors,
          ),
        )
        .pipeThrough(new CropIndexedFrame(this.config.backgroundColorIndex))
        .pipeThrough(new EncodeIndexdFrame())
        .pipeThrough(new EncodeGif({
          ...this.config,
          colorTable,
        }))
        .pipeTo(new WritableStream({
          write: chunk => resolve(chunk),
        }))
    })
    this.logger.timeEnd('encode')

    // reset
    this.frames = []
    this._encodeId = 0

    switch (format) {
      case 'blob':
        return new Blob([output.buffer], { type: 'image/gif' })
      case 'arrayBuffer':
      default:
        return output.buffer
    }
  }
}
