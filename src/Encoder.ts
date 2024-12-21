import type { EncoderOptions } from './options'
import type { EncodingFrame, UnencodedFrame } from './types'
import { Palette } from 'modern-palette'
import { createWorker } from './create-worker'
import { Logger } from './Logger'
import { CropIndexedFrame, EncodeGif, EncodeIndexdFrame, FrameToIndexedFrame } from './transformers'
import { loadImage, resovleSource } from './utils'

export interface EncoderConfig extends EncoderOptions {
  maxColors: number
  premultipliedAlpha: boolean
  tint: Array<number>
  colorTableSize: number
  backgroundColorIndex: number
}

export class Encoder {
  protected _logger: Logger
  protected _palette: Palette
  protected _config: EncoderConfig
  protected _encodingFrames: Array<EncodingFrame> = []
  protected _encodeUUID = 0
  protected _worker?: ReturnType<typeof createWorker>

  constructor(options: EncoderOptions) {
    this._logger = new Logger(Boolean(options.debug))
    this._config = this._resolveOptions(options)
    this._palette = new Palette({
      maxColors: this._config.maxColors,
      premultipliedAlpha: this._config.premultipliedAlpha,
      tint: this._config.tint,
    })
    if (this._config.workerUrl) {
      this._worker = createWorker({ workerUrl: this._config.workerUrl })
      this._worker.call('encoder:init', options)
    }
    else {
      this._config.frames?.forEach(frame => this.encode(frame))
    }
  }

  protected _resolveOptions(options: EncoderOptions): EncoderConfig {
    (['width', 'height'] as const).forEach((key) => {
      if (
        typeof options[key] !== 'undefined'
        && Math.floor(options[key]!) !== options[key]
      ) {
        console.warn(`${key} cannot be a floating point number`)
        options[key] = Math.floor(options[key]!)
      }
    })

    const {
      colorTableSize = 256,
      backgroundColorIndex = colorTableSize - 1,
      maxColors = colorTableSize - 1,
      premultipliedAlpha = false,
      tint = [0xFF, 0xFF, 0xFF],
    } = options

    return {
      ...options,
      colorTableSize,
      backgroundColorIndex,
      maxColors,
      premultipliedAlpha,
      tint,
    }
  }

  async encode(frame: UnencodedFrame): Promise<void> {
    if (this._worker) {
      let transfer: any | undefined
      if (ArrayBuffer.isView(frame.data)) {
        transfer = [frame.data.buffer]
      }
      else if (frame.data instanceof ArrayBuffer) {
        transfer = [frame.data]
      }
      return this._worker.call('encoder:encode', frame, transfer)
    }

    const id = this._encodeUUID
    this._encodeUUID++

    const {
      width: frameWidth = this._config.width,
      height: frameHeight = this._config.height,
    } = frame

    let { data } = frame

    try {
      this._logger.time(`palette:sample-${id}`)
      data = typeof data === 'string'
        ? await loadImage(data)
        : data

      data = resovleSource(data, 'uint8ClampedArray', {
        width: frameWidth,
        height: frameHeight,
      })

      this._encodingFrames.push({
        ...frame,
        width: frameWidth,
        height: frameHeight,
        data: data as any,
      })

      this._palette.addSample(data)
    }
    finally {
      this._logger.timeEnd(`palette:sample-${id}`)
    }
  }

  async flush(format: 'blob'): Promise<Blob>
  async flush(format?: 'arrayBuffer'): Promise<ArrayBuffer>
  async flush(format?: string): Promise<any> {
    if (this._worker) {
      return this._worker.call('encoder:flush', format)
    }

    this._logger.time('palette:generate')
    const colors = await this._palette.generate()
    this._logger.timeEnd('palette:generate')

    const colorTable = colors.map(color => [color.rgb.r, color.rgb.g, color.rgb.b])
    while (colorTable.length < this._config.colorTableSize) {
      colorTable.push([0, 0, 0])
    }

    this._logger.debug('palette:maxColors', this._config.maxColors)
    // eslint-disable-next-line no-console
    this._logger.isDebug && console.debug(
      colors.map(() => '%c ').join(''),
      ...colors.map(color => `margin: 1px; background: ${color.hex}`),
    )

    this._logger.time('encode')
    const output = await new Promise<Uint8Array>((resolve) => {
      new ReadableStream({
        start: (controller) => {
          this._encodingFrames.forEach((frame) => {
            controller.enqueue(frame)
          })
          controller.close()
        },
      })
        .pipeThrough(new FrameToIndexedFrame(this._config, colors))
        .pipeThrough(new CropIndexedFrame(this._config))
        .pipeThrough(new EncodeIndexdFrame(this._config))
        .pipeThrough(new EncodeGif({ ...this._config, colorTable }))
        .pipeTo(new WritableStream({ write: chunk => resolve(chunk) }))
    })
    this._logger.timeEnd('encode')

    // reset
    this._encodingFrames = []
    this._encodeUUID = 0

    switch (format) {
      case 'blob':
        return new Blob([output.buffer as ArrayBuffer], { type: 'image/gif' })
      case 'arrayBuffer':
      default:
        return output.buffer
    }
  }
}
