import {
  EXTENSION,
  EXTENSION_APPLICATION,
  EXTENSION_APPLICATION_BLOCK_SIZE,
  SIGNATURE,
  TRAILER,
} from './utils'
import { createWriter } from './create-writer'
import { encodeFrame } from './encode-frame'
import type { Frame, GIF } from './gif'

export interface Encoder {
  encode: (frame: Partial<Frame>) => void
  flush: () => Promise<Uint8Array>
}

export function createEncoder(options: Partial<GIF>): Encoder {
  const gif = {
    colorTableGeneration: 'NeuQuant',
    version: '89a',
    width: 0,
    height: 0,
    backgroundColorIndex: 0,
    pixelAspectRatio: 0,
    looped: true,
    ...options,
  } as GIF

  if (gif.width <= 0 || gif.width > 65535) throw new Error('Width invalid.')
  if (gif.height <= 0 || gif.height > 65535) throw new Error('Height invalid.')

  // Handling of global color table size
  let colorTableSize = 0
  if (gif.colorTable?.length) {
    let colorTableLength = gif.colorTable.length
    if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & (colorTableLength - 1)) {
      throw new Error('Invalid color table length, must be power of 2 and 2 .. 256.')
    }
    // eslint-disable-next-line no-cond-assign
    while (colorTableLength >>= 1) ++colorTableSize
    colorTableLength = 1 << colorTableSize
    --colorTableSize
    if (gif.backgroundColorIndex >= colorTableLength) {
      throw new Error('Background index out of range.')
    }
    if (gif.backgroundColorIndex === 0) {
      throw new Error('Background index explicitly passed as 0.')
    }
  }

  const writer = createWriter()

  const {
    writeByte,
    writeBytes,
    writeUnsigned,
    writeString,
    flush,
  } = writer

  function writeBaseInfo() {
    // Header
    writeString(SIGNATURE)
    writeString(gif.version)

    // Logical Screen Descriptor
    writeUnsigned(gif.width)
    writeUnsigned(gif.height)
    // <Packed Fields>
    // 1   : global color table flag = 1
    // 2-4 : color resolution = 7
    // 5   : global color table sort flag = 0
    // 6-8 : global color table size
    writeByte(parseInt(`${ colorTableSize ? 1 : 0 }1110${ colorTableSize.toString(2).padStart(3, '0') }`, 2))
    writeByte(gif.backgroundColorIndex) // background color index
    writeByte(gif.pixelAspectRatio) // pixel aspect ratio - assume 1:1

    // Global Color Table
    writeBytes(gif.colorTable?.flat() ?? [])

    // Netscape block
    if (gif.looped) {
      writeByte(EXTENSION) // extension introducer
      writeByte(EXTENSION_APPLICATION) // app extension label
      writeByte(EXTENSION_APPLICATION_BLOCK_SIZE) // block size
      writeString('NETSCAPE2.0') // app id + auth code
      writeByte(3) // sub-block size
      writeByte(1) // loop sub-block id
      writeUnsigned(gif.loopCount ?? 0) // loop count (extra iterations, 0=repeat forever)
      writeByte(0) // block terminator
    }
  }

  let frameIndex = 0
  let flushResolve: any | undefined
  const encodeing = new Map<number, boolean>()

  function onEncoded(index: number) {
    encodeing.delete(index)
    if (!encodeing.size) {
      flushResolve?.()
    }
  }

  function reset() {
    frameIndex = 0
    encodeing.clear()
    writeBaseInfo()
  }

  writeBaseInfo()

  const worker = gif.workerUrl ? new Worker(gif.workerUrl) : undefined
  if (worker) {
    worker.onmessage = event => {
      const { index, data } = event.data
      writeBytes(data)
      onEncoded(index)
    }
    worker.onmessageerror = event => onEncoded(event.data.index)
  }

  return {
    encode: (frame: Partial<Frame>) => {
      const index = frameIndex++
      if (worker && frame.imageData?.buffer) {
        encodeing.set(index, true)
        worker.postMessage({ index, frame }, [frame.imageData.buffer])
      } else {
        writeBytes(encodeFrame(frame))
        onEncoded(index)
      }
    },
    flush: () => {
      return new Promise(resolve => {
        const timer = setTimeout(() => flushResolve?.(), 30000)
        flushResolve = () => {
          timer && clearTimeout(timer)
          // Trailer
          writeByte(TRAILER)
          const data = flush()
          reset()
          resolve(data)
        }
      })
    },
  }
}
