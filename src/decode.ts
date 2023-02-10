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
import type { Application, Frame, GIF, GraphicControl, PlainText, RGB } from './types'

export function decode(data: Uint8Array): GIF {
  const gif = {} as GIF

  let cursor = 0

  // utils
  const readByte = (): number => data[cursor++]
  const readBytes = (length: number): Uint8Array => data.subarray(cursor, cursor += length)
  const readString = (length: number): string => Array.from(readBytes(length)).map(val => String.fromCharCode(val)).join('')
  const readUnsigned = (): number => new Uint16Array(data.buffer.slice(cursor, cursor += 2))[0]
  const read8Bits = (): number[] => readByte().toString(2).padStart(8, '0').split('').map(v => Number(v))
  const readColors = (length: number): RGB[] => Array.from({ length }, () => Array.from(readBytes(3)) as RGB)
  const readBlock = (): number[] => {
    const block: number[] = []
    while (true) {
      const val = readByte()
      if (val === 0 && data[cursor] !== 0) break
      block.push(val)
    }
    return block
  }

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
  // <Packed Fields> start
  const bits = read8Bits()
  gif.globalColorTable = Boolean(bits[0])
  gif.colorResoluTion = (parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1) as any
  gif.colorTableSorted = Boolean(bits[4])
  gif.colorTableSize = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)
  // <Packed Fields> end
  gif.backgroundColorIndex = readByte()
  gif.pixelAspectRatio = readByte()

  // Global Color Table
  if (gif.globalColorTable) {
    gif.colorTable = readColors(gif.colorTableSize)
  }

  gif.frames = [] as Frame[]

  let frame = {
    delay: 100,
  } as Frame

  while (true) {
    const flag = readByte()

    if (flag === IMAGE_DESCRIPTOR) {
      frame.left = readUnsigned()
      frame.top = readUnsigned()
      frame.width = readUnsigned()
      frame.height = readUnsigned()
      // <Packed Fields> start
      const bits = read8Bits()
      frame.localColorTable = Boolean(bits[0])
      frame.interlaced = Boolean(bits[1])
      frame.colorTableSorted = Boolean(bits[2])
      frame.reserved = parseInt(`${ bits[3] }${ bits[4] }`, 2) as any
      frame.colorTableSize = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)
      // <Packed Fields> end

      // Local Color Table
      if (frame.localColorTable) {
        frame.colorTable = readColors(frame.colorTableSize)
      }

      // LZW Minimum Code Size
      frame.lzwMinCodeSize = readByte()

      // Image Data
      frame.imageDataPositions = []
      while (true) {
        const length = readByte()
        if (length === 0) break
        frame.imageDataPositions.push([cursor, length])
        cursor += length
      }

      gif.frames.push(frame)
      frame = {} as Frame
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
        application.data = readBlock()
        frame.application = application
        continue
      }

      if (extensionFlag === EXTENSION_COMMENT) {
        frame.comment = readBlock().map(val => String.fromCharCode(val)).join('')
        continue
      }

      if (extensionFlag === EXTENSION_GRAPHIC_CONTROL) {
        if (readByte() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) continue
        const graphicControl = {} as GraphicControl
        // <Packed Fields> start
        const bits = read8Bits()
        graphicControl.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2) as any
        graphicControl.disposal = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2) as any
        graphicControl.userInput = Boolean(bits[6])
        graphicControl.transparent = Boolean(bits[7])
        // <Packed Fields> end
        graphicControl.delayTime = readUnsigned()
        graphicControl.transparentIndex = readByte()
        readBlock()

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
        plainText.data = readBlock()
        frame.plainText = plainText
        continue
      }

      console.warn(`Unknown gif extension block: 0x${ extensionFlag.toString(16) }`)
      continue
    }

    if (flag === TRAILER) break

    console.warn(`Unknown gif block: 0x${ flag.toString(16) }`)
  }

  return gif
}
