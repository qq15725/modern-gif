import {
  EXTENSION,
  EXTENSION_APPLICATION,
  EXTENSION_APPLICATION_BLOCK_SIZE,
  EXTENSION_COMMENT,
  EXTENSION_GRAPHIC_CONTROL,
  EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE,
  EXTENSION_PLAIN_TEXT,
  EXTENSION_PLAIN_TEXT_BLOCK_SIZE,
  IMAGE_DESCRIPTOR,
  SIGNATURE,
  TRAILER,
  VERSIONS,
  consoleWarn,
} from './utils'
import { createReader } from './create-reader'
import type { Application, Frame, Gif, GraphicControl } from './gif'

export function decode(source: BufferSource): Gif {
  const gif = {} as Gif

  const {
    getCursor,
    setCursor,
    readByte,
    readString,
    readUnsigned,
    readBits,
    readColorTable,
    readSubBlock,
  } = createReader(source)
  const createFrame = () => ({ index: 0, delay: 100, disposal: 0 }) as Frame

  // Header
  const signature = readString(3)
  const version = readString(3)
  if (signature !== SIGNATURE || !VERSIONS.includes(version)) {
    throw new Error('This is not a 87a/89a GIF data.')
  }
  gif.version = version as any

  // Logical Screen Descriptor
  gif.width = readUnsigned()
  gif.height = readUnsigned()
  // ↓ <Packed Fields>
  const bits = readBits()
  gif.globalColorTable = Boolean(bits[0])
  gif.colorResoluTion = (parseInt(bits.slice(1, 4).join(''), 2) + 1) as any
  gif.colorTableSorted = Boolean(bits[4])
  const colorTableSize = parseInt(bits.slice(5, 8).join(''), 2)
  gif.colorTableSize = colorTableSize ? Math.pow(2, colorTableSize + 1) : 0
  // ↑ <Packed Fields>
  gif.backgroundColorIndex = readByte()
  gif.pixelAspectRatio = readByte()

  // Global Color Table
  if (gif.globalColorTable) {
    if (gif.colorTableSize) {
      gif.colorTable = readColorTable(gif.colorTableSize)
    } else {
      readSubBlock()
    }
  }

  gif.frames = [] as Frame[]

  let frame = createFrame()
  const flags = []
  const extensionFlags = []

  while (true) {
    const flag = readByte()
    flags.push(flag)

    if (flag === IMAGE_DESCRIPTOR) {
      frame.left = readUnsigned()
      frame.top = readUnsigned()
      frame.width = readUnsigned()
      frame.height = readUnsigned()
      // ↓ <Packed Fields>
      const bits = readBits()
      frame.localColorTable = Boolean(bits[0])
      frame.interlaced = Boolean(bits[1])
      frame.colorTableSorted = Boolean(bits[2])
      frame.reserved = parseInt(bits.slice(3, 5).join(''), 2) as any
      const colorTableSize = parseInt(bits.slice(5, 8).join(''), 2)
      frame.colorTableSize = colorTableSize ? Math.pow(2, colorTableSize + 1) : 0
      // ↑ <Packed Fields>

      // Local Color Table
      if (frame.localColorTable) {
        frame.colorTable = readColorTable(frame.colorTableSize)
      }

      // LZW Minimum Code Size
      frame.lzwMinCodeSize = readByte()

      // Image Data
      frame.imageDataPositions = []
      while (true) {
        const length = readByte()
        if (length === 0) break
        const cursor = getCursor()
        frame.imageDataPositions.push([cursor, length])
        setCursor(cursor + length)
      }

      gif.frames.push(frame)
      frame = createFrame()
      frame.index = gif.frames.length
      continue
    }

    if (flag === EXTENSION) {
      const extensionFlag = readByte()
      extensionFlags.push(extensionFlag)

      if (extensionFlag === EXTENSION_APPLICATION) {
        if (readByte() !== EXTENSION_APPLICATION_BLOCK_SIZE) continue
        const application: Application = {
          identifier: readString(8),
          code: readString(3),
          data: [],
        }
        if (`${ application.identifier }${ application.code }` === 'NETSCAPE2.0') {
          if (readByte() === 3) {
            gif.looped = Boolean(readByte())
            gif.loopCount = readUnsigned()
          }
        }
        application.data = readSubBlock()
        frame.application = application
        continue
      }

      if (extensionFlag === EXTENSION_COMMENT) {
        frame.comment = readSubBlock().map(val => String.fromCharCode(val)).join('')
        continue
      }

      if (extensionFlag === EXTENSION_GRAPHIC_CONTROL) {
        if (readByte() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) continue
        const bits = readBits()
        const graphicControl: GraphicControl = {
          // ↓ <Packed Fields>
          reserved: parseInt(bits.slice(0, 3).join(''), 2) as any,
          disposal: parseInt(bits.slice(3, 6).join(''), 2) as any,
          userInput: Boolean(bits[6]),
          transparent: Boolean(bits[7]),
          // ↑ <Packed Fields>
          delayTime: readUnsigned(),
          transparentIndex: readByte(),
        }
        readSubBlock()

        frame.graphicControl = graphicControl
        frame.disposal = graphicControl.disposal
        frame.delay = (graphicControl.delayTime || 10) * 10
        continue
      }

      if (extensionFlag === EXTENSION_PLAIN_TEXT) {
        if (readByte() !== EXTENSION_PLAIN_TEXT_BLOCK_SIZE) continue
        frame.plainText = {
          left: readUnsigned(),
          top: readUnsigned(),
          width: readUnsigned(),
          height: readUnsigned(),
          cellWidth: readByte(),
          cellHeight: readByte(),
          colorIndex: readByte(),
          backgroundColorIndex: readByte(),
          data: readSubBlock(),
        }
        continue
      }

      consoleWarn(
        `Unknown extension block: 0x${ extensionFlag.toString(16) }`,
        flags.slice(0, flags.length - 1).map(val => `0x${ val.toString(16) }`),
        extensionFlags.slice(0, extensionFlags.length - 1).map(val => `0x${ val.toString(16) }`),
      )
      continue
    }

    if (flag === TRAILER) break

    consoleWarn(
      `Unknown block: 0x${ flag.toString(16) }`,
      flags.slice(0, flags.length - 1).map(val => `0x${ val.toString(16) }`),
      extensionFlags.slice(0, extensionFlags.length - 1).map(val => `0x${ val.toString(16) }`),
    )
  }

  return gif
}
