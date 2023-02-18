import {
  EXTENSION,
  EXTENSION_APPLICATION,
  EXTENSION_APPLICATION_BLOCK_SIZE,
  SIGNATURE,
  TRAILER,
} from './utils'
import { createWriter } from './create-writer'
import type { GIF } from './gif'

export interface Encoder {
  write: (frameData: Uint8Array) => void
  flush: () => Uint8Array
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
    writeUTFBytes,
    writeUint8,
    writeUint8Bytes,
    writeUint16LE,
    exportUint8Array,
  } = writer

  // Header
  writeUTFBytes(SIGNATURE)
  writeUTFBytes(gif.version)

  // Logical Screen Descriptor
  writeUint16LE(gif.width)
  writeUint16LE(gif.height)
  // <Packed Fields>
  // 1   : global color table flag = 1
  // 2-4 : color resolution = 7
  // 5   : global color table sort flag = 0
  // 6-8 : global color table size
  writeUint8(parseInt(`${ colorTableSize ? 1 : 0 }1110${ colorTableSize.toString(2).padStart(3, '0') }`, 2))
  writeUint8(gif.backgroundColorIndex) // background color index
  writeUint8(gif.pixelAspectRatio) // pixel aspect ratio - assume 1:1

  // Global Color Table
  writeUint8Bytes(gif.colorTable?.flat() ?? [])

  // Netscape block
  if (gif.looped) {
    writeUint8(EXTENSION) // extension introducer
    writeUint8(EXTENSION_APPLICATION) // app extension label
    writeUint8(EXTENSION_APPLICATION_BLOCK_SIZE) // block size
    writeUTFBytes('NETSCAPE2.0') // app id + auth code
    writeUint8(3) // sub-block size
    writeUint8(1) // loop sub-block id
    writeUint16LE(gif.loopCount ?? 0) // loop count (extra iterations, 0=repeat forever)
    writeUint8(0) // block terminator
  }

  return {
    write: (frameData: Uint8Array) => {
      writeUint8Bytes(frameData)
    },
    flush: () => {
      // Trailer
      writeUint8(TRAILER)

      return exportUint8Array()
    },
  }
}
