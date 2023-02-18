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
import type { Application, Frame, GIF, GraphicControl, PlainText, RGB } from './gif'

export function decode(data: Uint8Array): GIF {
  const gif = {} as GIF

  let cursor = 0

  // utils
  const readBytes = (length: number): Uint8Array => data.subarray(cursor, cursor += length)
  const readString = (length: number): string => Array.from(readBytes(length)).map(val => String.fromCharCode(val)).join('')
  const readUint8BE = (): number => data[cursor++]
  const readUint16BE = (): number => new DataView(data.buffer.slice(cursor, cursor += 2)).getUint16(0)
  const read8Bits = (): number[] => readUint8BE().toString(2).padStart(8, '0').split('').map(v => Number(v))
  const readColors = (length: number): RGB[] => Array.from({ length }, () => Array.from(readBytes(3)) as RGB)
  const readBlock = (): number[] => {
    const block: number[] = []
    while (true) {
      const val = readUint8BE()
      if (val === 0 && data[cursor] !== 0) break
      block.push(val)
    }
    return block
  }
  const createFrame = () => ({ index: 0, delay: 100, disposal: 0 }) as Frame

  // Header
  const signature = readString(3)
  const version = readString(3)
  if (signature !== SIGNATURE || !VERSIONS.includes(version)) {
    throw new Error('This is not a 87a/89a GIF data.')
  }
  gif.version = version as any

  // Logical Screen Descriptor
  gif.width = readUint16BE()
  gif.height = readUint16BE()
  // ↓ <Packed Fields>
  const bits = read8Bits()
  gif.globalColorTable = Boolean(bits[0])
  gif.colorResoluTion = (parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1) as any
  gif.colorTableSorted = Boolean(bits[4])
  const colorTableSize = parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2)
  gif.colorTableSize = colorTableSize ? Math.pow(2, colorTableSize + 1) : 0
  // ↑ <Packed Fields>
  gif.backgroundColorIndex = readUint8BE()
  gif.pixelAspectRatio = readUint8BE()

  // Global Color Table
  if (gif.globalColorTable) {
    gif.colorTable = readColors(gif.colorTableSize)
  }

  gif.frames = [] as Frame[]

  let frame = createFrame()

  while (true) {
    const flag = readUint8BE()

    if (flag === IMAGE_DESCRIPTOR) {
      frame.left = readUint16BE()
      frame.top = readUint16BE()
      frame.width = readUint16BE()
      frame.height = readUint16BE()
      // ↓ <Packed Fields>
      const bits = read8Bits()
      frame.localColorTable = Boolean(bits[0])
      frame.interlaced = Boolean(bits[1])
      frame.colorTableSorted = Boolean(bits[2])
      frame.reserved = parseInt(`${ bits[3] }${ bits[4] }`, 2) as any
      const colorTableSize = parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2)
      frame.colorTableSize = colorTableSize ? Math.pow(2, colorTableSize + 1) : 0
      // ↑ <Packed Fields>

      // Local Color Table
      if (frame.localColorTable) {
        frame.colorTable = readColors(frame.colorTableSize)
      }

      // LZW Minimum Code Size
      frame.lzwMinCodeSize = readUint8BE()

      // Image Data
      frame.imageDataPositions = []
      while (true) {
        const length = readUint8BE()
        if (length === 0) break
        frame.imageDataPositions.push([cursor, length])
        cursor += length
      }

      gif.frames.push(frame)
      frame = createFrame()
      frame.index = gif.frames.length
      continue
    }

    if (flag === EXTENSION) {
      const extensionFlag = readUint8BE()

      if (extensionFlag === EXTENSION_APPLICATION) {
        if (readUint8BE() !== EXTENSION_APPLICATION_BLOCK_SIZE) continue
        const application = {} as Application
        application.identifier = readString(8)
        application.code = readString(3)
        if (`${ application.identifier }${ application.code }` === 'NETSCAPE2.0') {
          if (readUint8BE() === 3) {
            gif.looped = Boolean(readUint8BE())
            gif.loopCount = readUint16BE()
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
        if (readUint8BE() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) continue
        const graphicControl = {} as GraphicControl
        // ↓ <Packed Fields>
        const bits = read8Bits()
        graphicControl.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2) as any
        frame.disposal = graphicControl.disposal = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2) as any
        graphicControl.userInput = Boolean(bits[6])
        graphicControl.transparent = Boolean(bits[7])
        // ↑ <Packed Fields>
        graphicControl.delayTime = readUint16BE()
        graphicControl.transparentIndex = readUint8BE()
        readBlock()

        frame.graphicControl = graphicControl
        frame.delay = (graphicControl.delayTime || 10) * 10
        continue
      }

      if (extensionFlag === EXTENSION_PLAIN_TEXT) {
        if (readUint8BE() !== EXTENSION_PLAIN_TEXT_BLOCK_SIZE) continue
        const plainText = {} as PlainText
        plainText.left = readUint16BE()
        plainText.top = readUint16BE()
        plainText.width = readUint16BE()
        plainText.height = readUint16BE()
        plainText.cellWidth = readUint8BE()
        plainText.cellHeight = readUint8BE()
        plainText.colorIndex = readUint8BE()
        plainText.backgroundColorIndex = readUint8BE()
        plainText.data = readBlock()
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
