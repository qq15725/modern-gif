import {
  TRAILER,
} from './utils'
import { encodeFrame } from './encode-frame'
import { encodeBasicInfo } from './encode-basic-info'
import type { EncodeFrameOptions, EncoderOptions } from './options'

export interface Encoder {
  encode: (frame: EncodeFrameOptions) => void
  flush: () => Promise<Uint8Array>
}

export function createEncoder(options: EncoderOptions): Encoder {
  const {
    workerUrl,
    workerNumber = 1,
  } = options

  let lastIndex = 0
  let flushResolve: any | undefined
  const encodeing = new Set<number>()
  let frames: Uint8Array[] = []
  let framesDataLength = 0

  function onEncoded(index: number) {
    encodeing.delete(index)
    !encodeing.size && flushResolve?.()
  }

  const basicInfo = encodeBasicInfo(options)

  const workers = [...new Array(workerUrl ? workerNumber : 0)].map(() => {
    const worker = new Worker(workerUrl!)
    worker.onmessage = event => {
      const { index, data } = event.data
      frames[index] = data
      framesDataLength += data.length
      onEncoded(index)
    }
    worker.onmessageerror = event => onEncoded(event.data.index)
    return worker
  })

  return {
    encode: frame => {
      const index = lastIndex++
      if (workers.length && frame.imageData.buffer) {
        encodeing.add(index)
        workers[index & (workers.length - 1)].postMessage(
          { index, frame },
          [frame.imageData.buffer],
        )
      } else {
        const data = encodeFrame(frame)
        frames[index] = data
        framesDataLength += data.length
        onEncoded(index)
      }
    },
    flush: () => {
      return new Promise(resolve => {
        const timer = setTimeout(() => flushResolve?.(), 30000)
        flushResolve = () => {
          timer && clearTimeout(timer)

          const data = new Uint8Array(basicInfo.length + framesDataLength + 1)
          data.set(basicInfo)
          let offset = basicInfo.length
          frames.forEach(frame => {
            data.set(frame, offset)
            offset += frame.length
          })
          // Trailer
          data[data.length - 1] = TRAILER
          resolve(data)

          // reset
          lastIndex = 0
          flushResolve = undefined
          encodeing.clear()
          frames = []
          framesDataLength = 0
        }
        !encodeing.size && flushResolve?.()
      })
    },
  } as Encoder
}
