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
import type { Application, Frame, Gif, GraphicControl, PlainText } from './gif'

export function decode(data: Uint8Array): Gif {
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
  } = createReader(data)
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
  gif.colorResoluTion = (parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1) as any
  gif.colorTableSorted = Boolean(bits[4])
  const colorTableSize = parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2)
  gif.colorTableSize = colorTableSize ? Math.pow(2, colorTableSize + 1) : 0
  // ↑ <Packed Fields>
  gif.backgroundColorIndex = readByte()
  gif.pixelAspectRatio = readByte()

  // Global Color Table
  if (gif.globalColorTable) {
    gif.colorTable = readColorTable(gif.colorTableSize)
  }

  gif.frames = [] as Frame[]

  let frame = createFrame()

  while (true) {
    const flag = readByte()

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
      frame.reserved = parseInt(`${ bits[3] }${ bits[4] }`, 2) as any
      const colorTableSize = parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2)
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

      if (extensionFlag === EXTENSION_APPLICATION) {
        if (readByte() !== EXTENSION_APPLICATION_BLOCK_SIZE) continue
        const application = {} as Application
        application.identifier = readString(8)
        application.code = readString(3)
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
        const graphicControl = {} as GraphicControl
        // ↓ <Packed Fields>
        const bits = readBits()
        graphicControl.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2) as any
        frame.disposal = graphicControl.disposal = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2) as any
        graphicControl.userInput = Boolean(bits[6])
        graphicControl.transparent = Boolean(bits[7])
        // ↑ <Packed Fields>
        graphicControl.delayTime = readUnsigned()
        graphicControl.transparentIndex = readByte()
        readSubBlock()

        frame.graphicControl = graphicControl
        frame.delay = (graphicControl.delayTime || 10) * 10
        continue
      }

      if (extensionFlag === EXTENSION_PLAIN_TEXT) {
        if (readByte() !== EXTENSION_PLAIN_TEXT_BLOCK_SIZE) continue
        const plainText = {} as PlainText
        plainText.left = readUnsigned()
        plainText.top = readUnsigned()
        plainText.width = readUnsigned()
        plainText.height = readUnsigned()
        plainText.cellWidth = readByte()
        plainText.cellHeight = readByte()
        plainText.colorIndex = readByte()
        plainText.backgroundColorIndex = readByte()
        plainText.data = readSubBlock()
        frame.plainText = plainText
        continue
      }

      consoleWarn(`Unknown extension block: 0x${ extensionFlag.toString(16) }`)
      continue
    }

    if (flag === TRAILER) break

    consoleWarn(`Unknown block: 0x${ flag.toString(16) }`)
  }

  return gif
}
