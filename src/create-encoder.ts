import { createPalette } from 'modern-palette'
import { TRAILER } from './utils'
import { encodeHeader } from './encode-header'
import { encodeFrame } from './encode-frame'
import { croppingFrames } from './cropping-frames'
import { convertFramesToIndexes } from './convert-frames-to-indexes'
import type { EncodeFrameOptions, EncoderOptions } from './options'

export function createEncoder(options: EncoderOptions) {
  const {
    width,
    height,
    workerUrl,
    workerNumber = 1,
    colorTableSize = 256,
    maxColors = colorTableSize - 1,
    backgroundColorIndex = colorTableSize - 1,
  } = options

  let frames: EncodeFrameOptions[] = []

  const transparentIndex = backgroundColorIndex
  const palette = createPalette({ maxColors })
  const workersLength = workerUrl ? workerNumber : 0
  const workersCallbacks = new Map<number, any>()
  const workers = [...new Array(workersLength)].map(() => {
    const worker = new Worker(workerUrl!)
    worker.onmessage = (res) => {
      const { uuid, data } = res.data
      workersCallbacks.get(uuid)?.(data)
      workersCallbacks.delete(uuid)
    }
    return worker
  })

  let i = 0
  function execInWorker(message: any, transfer: Transferable[]) {
    if (!workersLength) return undefined
    return new Promise(resolve => {
      const uuid = i++
      message.uuid = uuid
      workersCallbacks.set(uuid, resolve)
      workers[uuid % workersLength].postMessage(message, transfer)
    })
  }

  async function encodeFrameInWorker(
    frame: EncodeFrameOptions,
    indexes: Uint8Array,
  ): Promise<ReturnType<typeof encodeFrame>> {
    const result = await execInWorker(
      { type: 'encode-frame', frame, indexes },
      [frame.imageData.buffer, indexes.buffer],
    )
    if (result) return result as any
    return encodeFrame(frame, indexes)
  }

  return {
    encode: (frame: EncodeFrameOptions): void => {
      frames.push({ width, height, ...frame })
      palette.addSample(frame.imageData)
    },
    flush: (): Promise<Uint8Array> => {
      return new Promise((resolve) => {
        const colorTable = palette
          .generate()
          .getColors('rgb')
          .map(val => val.color)

        while (colorTable.length < colorTableSize) {
          colorTable.push([0, 0, 0])
        }

        const encodedHeader = encodeHeader({
          colorTable,
          backgroundColorIndex,
          ...options,
        })

        const { allIndexes, transparents } = convertFramesToIndexes(
          frames,
          palette,
          transparentIndex,
        )

        const { boxes, allIndexes: croppedAllIndexes } = croppingFrames(
          frames,
          allIndexes,
          transparents,
          transparentIndex,
        )

        Promise.all(frames.map((frame, index) => {
          const box = boxes[index]
          return encodeFrameInWorker(
            {
              ...frame,
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              disposal: box.disposal,
              graphicControl: {
                ...frame.graphicControl,
                transparent: true,
                transparentIndex: backgroundColorIndex,
              } as any,
            },
            croppedAllIndexes[index],
          )
        })).then(encodedFrames => {
          const encodedBody = new Uint8Array(
            encodedFrames.reduce((total, frameData) => total + frameData.byteLength, 0),
          )

          let offset = 0
          encodedFrames.forEach((encoded) => {
            encodedBody.set(encoded, offset)
            offset += encoded.length
          })

          const data = new Uint8Array(
            encodedHeader.length + encodedBody.byteLength + 1,
          )
          data.set(encodedHeader)
          data.set(encodedBody, encodedHeader.byteLength)
          data[data.length - 1] = TRAILER

          resolve(data)

          // reset
          palette.reset()
          frames = []
          workersCallbacks.clear()
        })
      })
    },
  }
}
