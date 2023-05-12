import { createPalette } from 'modern-palette'
import { TRAILER, loadImage, mergeBuffers, resovleSource } from './utils'
import { encodeHeader } from './encode-header'
import { encodeFrame } from './encode-frame'
import { indexFrames } from './index-frames'
import { cropFrames } from './crop-frames'
import { createLogger } from './create-logger'
import { createWorker } from './create-worker'
import type { Context } from 'modern-palette'
import type { CropFramesOptions } from './crop-frames'
import type { IndexFramesOptions } from './index-frames'
import type { EncodeFrameOptions, EncoderOptions } from './options'

export function createEncoder(options: EncoderOptions) {
  const {
    width,
    height,
    workerUrl,
    workerNumber = 1,
    colorTableSize = 256,
    backgroundColorIndex = colorTableSize - 1,
    maxColors = colorTableSize - 1,
    debug = false,
  } = options

  const encoder = {
    width,
    height,
    maxColors,
    frames: [] as EncodeFrameOptions<Uint8ClampedArray>[],
    log: createLogger(debug),
    palette: createPalette(),
    worker: createWorker({ workerUrl, workerNumber }),
    encodeId: 0,
    async encode(options: EncodeFrameOptions): Promise<void> {
      const { log, frames, encodeId, width, height } = encoder

      encoder.encodeId++

      const { width: frameWidth = width, height: frameHeight = height } = options
      let { imageData: source } = options

      log.time(`palette:sample-${ encodeId }`)

      try {
        source = typeof source === 'string'
          ? await loadImage(source)
          : source

        const imageData = resovleSource(source, 'uint8ClampedArray', {
          width: frameWidth,
          height: frameHeight,
        })

        frames.push({
          width: frameWidth,
          height: frameHeight,
          ...options,
          imageData,
        })

        await addSampleInWorker(imageData)
      } finally {
        log.timeEnd(`palette:sample-${ encodeId }`)
      }
    },
    async flush(): Promise<Uint8Array> {
      const { log, frames, width, height, maxColors, palette } = encoder

      log.time('palette:generate')
      const context = await generateInWorker(maxColors)
      const colorTable = createPalette(context)
        .getColors('rgb')
        .map(val => val.color)

      // debug
      log.debug('palette:maxColors', maxColors)
      const hexColorTable = colorTable.map(rgb => {
        const r = rgb[0].toString(16).padStart(2, '0')
        const g = rgb[1].toString(16).padStart(2, '0')
        const b = rgb[2].toString(16).padStart(2, '0')
        return `#${ r }${ g }${ b }`
      })
      // eslint-disable-next-line no-console
      debug && console.debug(
        hexColorTable.map(() => '%c ').join(''),
        ...hexColorTable.map(hex => `margin: 1px; background: ${ hex }`),
      )

      while (colorTable.length < colorTableSize) {
        colorTable.push([0, 0, 0])
      }
      log.timeEnd('palette:generate')

      log.time('frames:index')
      const indexedFrames = await indexFramesInWorker({
        frames,
        palette: context,
        transparentIndex: backgroundColorIndex,
      })
      log.timeEnd('frames:index')

      log.time('frames:crop')
      const croppedFrames = await cropFramesInWorker({
        frames: indexedFrames.map((indexedFrame, index) => {
          const { width = 1, height = 1 } = frames[index]
          return {
            ...indexedFrame,
            width,
            height,
          }
        }),
        transparentIndex: backgroundColorIndex,
      })
      log.timeEnd('frames:crop')

      log.time('frames:encode')
      const encodedFrames = await Promise.all(frames.map((frame, index) => {
        return encodeFrameInWorker(
          {
            ...frame,
            ...croppedFrames[index],
            graphicControl: {
              ...frame.graphicControl,
              transparent: true,
              transparentIndex: backgroundColorIndex,
            } as any,
          },
        )
      }))
      log.timeEnd('frames:encode')

      log.time('output')
      const header = encodeHeader({
        ...options,
        colorTable,
        backgroundColorIndex,
        width,
        height,
      })
      const body = mergeBuffers(encodedFrames)
      const output = new Uint8Array(header.length + body.byteLength + 1)
      output.set(header)
      output.set(body, header.byteLength)
      output[output.length - 1] = TRAILER
      log.timeEnd('output')

      // reset
      palette.reset()
      encoder.frames = []
      encoder.encodeId = 0

      return output
    },
  }

  async function addSampleInWorker(options: Uint8ClampedArray): Promise<void> {
    const result = await encoder.worker.call(
      'palette:addSample', options,
      undefined,
      0,
    )
    if (result) return
    encoder.palette.addSample(options)
  }

  async function generateInWorker(maxColors: number): Promise<Context> {
    const result = await encoder.worker.call(
      'palette:generate', { maxColors },
      undefined,
      0,
    )
    if (result) return result as any
    encoder.palette.generate({ maxColors })
    return encoder.palette.context
  }

  async function indexFramesInWorker(options: IndexFramesOptions): Promise<ReturnType<typeof indexFrames>> {
    const result = await encoder.worker.call(
      'frames:index', options,
    )
    if (result) return result as any
    return indexFrames(options)
  }

  async function cropFramesInWorker(options: CropFramesOptions): Promise<ReturnType<typeof cropFrames>> {
    const result = await encoder.worker.call(
      'frames:crop', options,
      options.frames.map(val => val.imageData.buffer),
    )
    if (result) return result as any
    return cropFrames(options)
  }

  async function encodeFrameInWorker(options: EncodeFrameOptions<Uint8ClampedArray>): Promise<ReturnType<typeof encodeFrame>> {
    const result = await encoder.worker.call(
      'frame:encode', options,
      [options.imageData.buffer],
    )
    if (result) return result as any
    return encodeFrame(options)
  }

  return encoder
}
