import { EXTENSION, EXTENSION_GRAPHIC_CONTROL, EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE, IMAGE_DESCRIPTOR } from './utils'
import { lzwEncode } from './lzw-encode'
import { createWriter } from './create-writer'
import type { EncodeFrameOptions } from './options'

export function encodeFrame(frame: EncodeFrameOptions<Uint8ClampedArray>): Uint8Array {
  const writer = createWriter()

  const {
    writeByte,
    writeBytes,
    writeUnsigned,
    flush,
  } = writer

  const {
    left = 0,
    top = 0,
    width = 0,
    height = 0,
    delay = 100,
    colorTable,
  } = frame

  let {
    disposal = 0,
  } = frame

  const transparent = frame.graphicControl?.transparent
  let transparentIndex = frame.graphicControl?.transparentIndex ?? 255

  if (left < 0 || left > 65535) throw new Error('Left invalid.')
  if (top < 0 || top > 65535) throw new Error('Top invalid.')
  if (width <= 0 || width > 65535) throw new Error('Width invalid.')
  if (height <= 0 || height > 65535) throw new Error('Height invalid.')

  // color table
  let minCodeSize = 8
  let colorTableLength = colorTable ? colorTable.length : 0
  if (colorTableLength) {
    if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & (colorTableLength - 1)) {
      throw new Error('Invalid color table length, must be power of 2 and 2 .. 256.')
    }
    // eslint-disable-next-line no-cond-assign
    while (colorTableLength >>= 1) ++minCodeSize
    // colorTableLength = 1 << minCodeSize // Now we can easily get it back.
  }

  // Graphic control extension
  writeByte(EXTENSION) // extension introducer
  writeByte(EXTENSION_GRAPHIC_CONTROL) // GCE label
  writeByte(EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) // block size
  if (transparent) {
    if (!disposal) {
      disposal = 2 // force clear if using transparent color
    }
  } else {
    transparentIndex = 0
  }
  // <Packed Fields>
  // 1-3 : reserved = 0
  // 4-6 : disposal
  // 7   : user input flag = 0
  // 8   : transparency flag
  writeByte(parseInt(`000${ Number(disposal & 7).toString(2).padStart(3, '0') }0${ transparent ? 1 : 0 }`, 2))
  writeUnsigned(delay / 10) // delay x 1/100 sec
  writeByte(transparentIndex) // transparent color index
  writeByte(0) // block terminator

  // Image descriptor
  writeByte(IMAGE_DESCRIPTOR) // image separator
  writeUnsigned(left) // image position
  writeUnsigned(top)
  writeUnsigned(width) // image size
  writeUnsigned(height)
  // <Packed Fields>
  if (colorTable?.length) {
    // 1   : local color table = 1
    // 2   : interlace = 0
    // 3   : sorted = 0
    // 4-5 : reserved = 0
    // 6-8 : local color table size
    writeByte(parseInt(`10000${ (minCodeSize - 1).toString(2).padStart(3, '0') }`, 2))

    // Local Color Table
    writeBytes(colorTable.flat())
  } else {
    writeByte(0)
  }

  // LZW
  lzwEncode(minCodeSize, frame.imageData, writer)

  return flush()
}
