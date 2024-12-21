import type { Application, Frame, Gif, GraphicControl } from './types'
import { Reader } from './Reader'
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
} from './utils'

export function decode(source: BufferSource): Gif {
  const gif = {} as Gif

  const reader = new Reader(source)
  const createFrame = (): Frame => ({ index: 0, delay: 100, disposal: 0 }) as Frame

  // Header
  const signature = reader.readString(3)
  const version = reader.readString(3)
  if (signature !== SIGNATURE || !VERSIONS.includes(version)) {
    throw new Error('This is not a 87a/89a GIF data.')
  }
  gif.version = version as any

  // Logical Screen Descriptor
  gif.width = reader.readUnsigned()
  gif.height = reader.readUnsigned()
  // ↓ <Packed Fields>
  const bits = reader.readBits()
  gif.globalColorTable = Boolean(bits[0])
  gif.colorResoluTion = (Number.parseInt(bits.slice(1, 4).join(''), 2) + 1) as any
  gif.colorTableSorted = Boolean(bits[4])
  const colorTableSize = Number.parseInt(bits.slice(5, 8).join(''), 2)
  gif.colorTableSize = 2 ** (colorTableSize + 1)
  // ↑ <Packed Fields>
  gif.backgroundColorIndex = reader.readByte()
  gif.pixelAspectRatio = reader.readByte()

  // Global Color Table
  if (gif.globalColorTable) {
    if (gif.colorTableSize) {
      gif.colorTable = reader.readColorTable(gif.colorTableSize)
    }
    else {
      reader.readSubBlock()
    }
  }

  gif.frames = [] as Frame[]

  let frame = createFrame()
  const flags = []
  const extensionFlags = []

  while (true) {
    const flag = reader.readByte()
    flags.push(flag)

    if (flag === IMAGE_DESCRIPTOR) {
      frame.left = reader.readUnsigned()
      frame.top = reader.readUnsigned()
      frame.width = reader.readUnsigned()
      frame.height = reader.readUnsigned()
      // ↓ <Packed Fields>
      const bits = reader.readBits()
      frame.localColorTable = Boolean(bits[0])
      frame.interlaced = Boolean(bits[1])
      frame.colorTableSorted = Boolean(bits[2])
      frame.reserved = Number.parseInt(bits.slice(3, 5).join(''), 2) as any
      const colorTableSize = Number.parseInt(bits.slice(5, 8).join(''), 2)
      frame.colorTableSize = 2 ** (colorTableSize + 1)
      // ↑ <Packed Fields>

      // Local Color Table
      if (frame.localColorTable) {
        frame.colorTable = reader.readColorTable(frame.colorTableSize)
      }

      // LZW Minimum Code Size
      frame.lzwMinCodeSize = reader.readByte()

      // Image Data
      frame.dataPositions = []
      while (true) {
        const length = reader.readByte()
        if (length === 0)
          break
        const offset = reader.offset
        frame.dataPositions.push([offset, length])
        reader.offset = offset + length
      }

      gif.frames.push(frame)
      frame = createFrame()
      frame.index = gif.frames.length
      continue
    }

    if (flag === EXTENSION) {
      const extensionFlag = reader.readByte()
      extensionFlags.push(extensionFlag)

      if (extensionFlag === EXTENSION_APPLICATION) {
        if (reader.readByte() !== EXTENSION_APPLICATION_BLOCK_SIZE)
          continue
        const application: Application = {
          identifier: reader.readString(8),
          code: reader.readString(3),
          data: [],
        }
        if (`${application.identifier}${application.code}` === 'NETSCAPE2.0') {
          if (reader.readByte() === 3) {
            gif.looped = Boolean(reader.readByte())
            gif.loopCount = reader.readUnsigned()
          }
        }
        application.data = reader.readSubBlock()
        frame.application = application
        continue
      }

      if (extensionFlag === EXTENSION_COMMENT) {
        frame.comment = reader.readSubBlock().map(val => String.fromCharCode(val)).join('')
        continue
      }

      if (extensionFlag === EXTENSION_GRAPHIC_CONTROL) {
        if (reader.readByte() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE)
          continue
        const bits = reader.readBits()
        const graphicControl: GraphicControl = {
          // ↓ <Packed Fields>
          reserved: Number.parseInt(bits.slice(0, 3).join(''), 2) as any,
          disposal: Number.parseInt(bits.slice(3, 6).join(''), 2) as any,
          userInput: Boolean(bits[6]),
          transparent: Boolean(bits[7]),
          // ↑ <Packed Fields>
          delayTime: reader.readUnsigned(),
          transparentIndex: reader.readByte(),
        }
        reader.readSubBlock()

        frame.graphicControl = graphicControl
        frame.disposal = graphicControl.disposal
        frame.delay = (graphicControl.delayTime || 10) * 10
        continue
      }

      if (extensionFlag === EXTENSION_PLAIN_TEXT) {
        if (reader.readByte() !== EXTENSION_PLAIN_TEXT_BLOCK_SIZE)
          continue
        frame.plainText = {
          left: reader.readUnsigned(),
          top: reader.readUnsigned(),
          width: reader.readUnsigned(),
          height: reader.readUnsigned(),
          cellWidth: reader.readByte(),
          cellHeight: reader.readByte(),
          colorIndex: reader.readByte(),
          backgroundColorIndex: reader.readByte(),
          data: reader.readSubBlock(),
        }
        continue
      }

      console.warn(
        `Unknown extension block: 0x${extensionFlag.toString(16)}`,
        flags.slice(0, flags.length - 1).map(val => `0x${val.toString(16)}`),
        extensionFlags.slice(0, extensionFlags.length - 1).map(val => `0x${val.toString(16)}`),
      )
      continue
    }

    if (flag === TRAILER)
      break

    console.warn(
      `Unknown block: 0x${flag.toString(16)}`,
      flags.slice(0, flags.length - 1).map(val => `0x${val.toString(16)}`),
      extensionFlags.slice(0, extensionFlags.length - 1).map(val => `0x${val.toString(16)}`),
    )
  }

  return gif
}
