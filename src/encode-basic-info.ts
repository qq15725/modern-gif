import { EXTENSION, EXTENSION_APPLICATION, EXTENSION_APPLICATION_BLOCK_SIZE, SIGNATURE } from './utils'
import { createWriter } from './create-writer'
import type { EncoderOptions } from './options'

export function encodeBasicInfo(options: EncoderOptions) {
  const gif = {
    version: '89a',
    looped: true,
    loopCount: 0,
    width: 0,
    height: 0,
    colorTableSize: 0,
    backgroundColorIndex: 0,
    pixelAspectRatio: 0,
    ...options,
  }

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
    gif.colorTableSize = --colorTableSize
    if (gif.backgroundColorIndex >= colorTableLength) {
      throw new Error('Background index out of range.')
    }
    if (gif.backgroundColorIndex === 0) {
      throw new Error('Background index explicitly passed as 0.')
    }
  }

  // max length 32 + 256 * 3
  const writer = createWriter()

  const {
    writeByte,
    writeBytes,
    writeUnsigned,
    writeString,
    flush,
  } = writer

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
  writeByte(parseInt(`${ gif.colorTableSize ? 1 : 0 }1110${ gif.colorTableSize.toString(2).padStart(3, '0') }`, 2))
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
    writeUnsigned(gif.loopCount) // loop count (extra iterations, 0=repeat forever)
    writeByte(0) // block terminator
  }

  return flush()
}
