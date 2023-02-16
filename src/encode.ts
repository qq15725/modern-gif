import {
  EXTENSION,
  EXTENSION_APPLICATION,
  EXTENSION_APPLICATION_BLOCK_SIZE,
  EXTENSION_GRAPHIC_CONTROL,
  EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE,
  IMAGE_DESCRIPTOR,
  SIGNATURE,
  TRAILER,
} from './utils'
import { createEncoderContext } from './create-encoder-context'
import { writeDataByLzw } from './write-data-by-lzw'
import { getPaletteByMmcq } from './get-palette-by-mmcq'
import type { GIF } from './gif'

export function encode(options: Partial<GIF>): Uint8Array {
  const gif = {
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

  const context = createEncoderContext()

  const {
    writeString,
    writeByte,
    writeBytes,
    writeUnsigned,
    exportData,
  } = context

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

  gif.frames.forEach((frame) => {
    const {
      left = 0,
      top = 0,
      width = gif.width,
      height = gif.height,
      delay = 100,
      imageData = new Uint8ClampedArray(0),
    } = frame

    let {
      disposal = 0,
      colorTable = gif.colorTable,
    } = frame

    let transparent = frame.graphicControl?.transparent
    let transparentIndex = frame.graphicControl?.transparentIndex

    if (left < 0 || left > 65535) throw new Error('Left invalid.')
    if (top < 0 || top > 65535) throw new Error('Top invalid.')
    if (width <= 0 || width > 65535) throw new Error('Width invalid.')
    if (height <= 0 || height > 65535) throw new Error('Height invalid.')

    // color table
    if (!colorTable && imageData.length) {
      colorTable = getPaletteByMmcq(imageData, 255)
      if (colorTable.length < 256) {
        const diff = 256 - colorTable.length
        for (let i = 0; i < diff; i++) {
          colorTable.push([0, 0, 0])
        }
      }
      transparent = true
      transparentIndex = 255
    }
    let colorTableLength = colorTable ? colorTable.length : 0
    if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & (colorTableLength - 1)) {
      throw new Error('Invalid color table length, must be power of 2 and 2 .. 256.')
    }
    let minCodeSize = 0
    // eslint-disable-next-line no-cond-assign
    while (colorTableLength >>= 1) ++minCodeSize
    colorTableLength = 1 << minCodeSize // Now we can easily get it back.

    function findClosestRGB(r: number, g: number, b: number) {
      if (!colorTable) return -1
      let minpos = 0
      let dmin = 256 * 256 * 256
      for (let index = 0; index < colorTableLength; index++) {
        const dr = r - (colorTable[index][0] & 0xFF)
        const dg = g - (colorTable[index][1] & 0xFF)
        const db = b - (colorTable[index][2] & 0xFF)
        const d = dr * dr + dg * dg + db * db
        if (d < dmin) {
          dmin = d
          minpos = index
        }
      }
      return minpos
    }

    const imageDataLength = imageData.length
    const indexes = new Uint8Array(imageDataLength / 4)
    for (let i = 0; i < imageDataLength; i += 4) {
      if (imageData[i + 3] === 0) {
        indexes[i / 4] = 255
      } else {
        indexes[i / 4] = findClosestRGB(
          imageData[i] & 0xFF,
          imageData[i + 1] & 0xFF,
          imageData[i + 2] & 0xFF,
        )
      }
    }

    // Graphic control extension
    writeByte(EXTENSION) // extension introducer
    writeByte(EXTENSION_GRAPHIC_CONTROL) // GCE label
    writeByte(EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) // block size
    if (transparent) {
      if (!transparentIndex || transparentIndex < 0 || transparentIndex >= colorTableLength) {
        throw new Error('Transparent color index.')
      }
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
    writeUnsigned(left) // image position x,y = 0,0
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
    writeDataByLzw(minCodeSize, indexes, context)
  })

  // Trailer
  writeByte(TRAILER)

  return exportData()
}
