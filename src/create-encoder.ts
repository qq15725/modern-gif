import { createPalette } from 'modern-palette'
import { TRAILER, mergeUint8Array } from './utils'
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
    debug = false,
  } = options

  let {
    maxColors = colorTableSize - 1,
  } = options

  let frames: EncodeFrameOptions[] = []

  const transparentIndex = backgroundColorIndex
  const log = createLogger(debug)
  const palette = createPalette()

  const worker = createWorker({
    workerUrl,
    workerNumber,
  })

  async function addSampleInWorker(
    options: Uint8ClampedArray,
  ): Promise<void> {
    const result = await worker.call(
      { type: 'palette:addSample', options },
      [options.buffer],
      0,
    )
    if (result) return
    palette.addSample(options)
  }

  async function generateInWorker(): Promise<Context> {
    const result = await worker.call(
      { type: 'palette:generate', options: { maxColors } },
      undefined,
      0,
    )
    if (result) return result as any
    palette.generate({ maxColors })
    return palette.context
  }

  async function indexFramesInWorker(
    options: IndexFramesOptions,
  ): Promise<ReturnType<typeof indexFrames>> {
    const result = await worker.call(
      { type: 'frames:index', options },
      options.frames.map(val => val.imageData.buffer),
    )
    if (result) return result as any
    return indexFrames(options)
  }

  async function cropFramesInWorker(
    options: CropFramesOptions,
  ): Promise<ReturnType<typeof cropFrames>> {
    const result = await worker.call(
      { type: 'frames:crop', options },
      options.frames.map(val => val.imageData.buffer),
    )
    if (result) return result as any
    return cropFrames(options)
  }

  async function encodeFrameInWorker(
    options: EncodeFrameOptions,
  ): Promise<ReturnType<typeof encodeFrame>> {
    const result = await worker.call(
      { type: 'frame:encode', options },
      [options.imageData.buffer],
    )
    if (result) return result as any
    return encodeFrame(options)
  }

  return {
    setMaxColors(value: number): void {
      maxColors = value
    },
    async encode(frame: EncodeFrameOptions): Promise<void> {
      const index = frames.length
      if (index === 0) {
        await worker.call({ type: 'palette:init' }, undefined, 0)
      }
      log.time(`palette:sample-${ index }`)
      frames.push({ width, height, ...frame })
      await addSampleInWorker(frame.imageData.slice(0))
      log.timeEnd(`palette:sample-${ index }`)
    },
    async flush(): Promise<Uint8Array> {
      log.time('palette:generate')
      const context = await generateInWorker()
      const colorTable = createPalette(context)
        .getColors('rgb')
        .map(val => val.color)
      while (colorTable.length < colorTableSize) {
        colorTable.push([0, 0, 0])
      }
      log.timeEnd('palette:generate')

      log.time('frames:index')
      const indexedFrames = await indexFramesInWorker({
        frames: frames.map(frame => ({ imageData: frame.imageData.slice(0) })),
        palette: context,
        transparentIndex,
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
        transparentIndex,
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
        colorTable,
        backgroundColorIndex,
        ...options,
      })
      const body = mergeUint8Array(...encodedFrames)
      const output = new Uint8Array(header.length + body.byteLength + 1)
      output.set(header)
      output.set(body, header.byteLength)
      output[output.length - 1] = TRAILER
      log.timeEnd('output')

      // reset
      palette.reset()
      frames = []

      return output
    },
  }
}
