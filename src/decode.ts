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
  const readUint8 = (): number => data[cursor++]
  const readUint8Bytes = (length: number): Uint8Array => data.subarray(cursor, cursor += length)
  const readUTFBytes = (length: number): string => Array.from(readUint8Bytes(length)).map(val => String.fromCharCode(val)).join('')
  const readUint16LE = (): number => new DataView(data.buffer.slice(cursor, cursor += 2)).getUint16(0, true)
  const readBits8 = (): number[] => readUint8().toString(2).padStart(8, '0').split('').map(v => Number(v))
  const readColors = (length: number): RGB[] => Array.from({ length }, () => Array.from(readUint8Bytes(3)) as RGB)
  const readBlock = (): number[] => {
    const block: number[] = []
    while (true) {
      const val = readUint8()
      if (val === 0 && data[cursor] !== 0) break
      block.push(val)
    }
    return block
  }
  const createFrame = () => ({ index: 0, delay: 100, disposal: 0 }) as Frame

  // Header
  const signature = readUTFBytes(3)
  const version = readUTFBytes(3)
  if (signature !== SIGNATURE || !VERSIONS.includes(version)) {
    throw new Error('This is not a 87a/89a GIF data.')
  }
  gif.version = version as any

  // Logical Screen Descriptor
  gif.width = readUint16LE()
  gif.height = readUint16LE()
  // ↓ <Packed Fields>
  const bits = readBits8()
  gif.globalColorTable = Boolean(bits[0])
  gif.colorResoluTion = (parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1) as any
  gif.colorTableSorted = Boolean(bits[4])
  const colorTableSize = parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2)
  gif.colorTableSize = colorTableSize ? Math.pow(2, colorTableSize + 1) : 0
  // ↑ <Packed Fields>
  gif.backgroundColorIndex = readUint8()
  gif.pixelAspectRatio = readUint8()

  // Global Color Table
  if (gif.globalColorTable) {
    gif.colorTable = readColors(gif.colorTableSize)
  }

  gif.frames = [] as Frame[]

  let frame = createFrame()

  while (true) {
    const flag = readUint8()

    if (flag === IMAGE_DESCRIPTOR) {
      frame.left = readUint16LE()
      frame.top = readUint16LE()
      frame.width = readUint16LE()
      frame.height = readUint16LE()
      // ↓ <Packed Fields>
      const bits = readBits8()
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
      frame.lzwMinCodeSize = readUint8()

      // Image Data
      frame.imageDataPositions = []
      while (true) {
        const length = readUint8()
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
      const extensionFlag = readUint8()

      if (extensionFlag === EXTENSION_APPLICATION) {
        if (readUint8() !== EXTENSION_APPLICATION_BLOCK_SIZE) continue
        const application = {} as Application
        application.identifier = readUTFBytes(8)
        application.code = readUTFBytes(3)
        if (`${ application.identifier }${ application.code }` === 'NETSCAPE2.0') {
          if (readUint8() === 3) {
            gif.looped = Boolean(readUint8())
            gif.loopCount = readUint16LE()
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
        if (readUint8() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) continue
        const graphicControl = {} as GraphicControl
        // ↓ <Packed Fields>
        const bits = readBits8()
        graphicControl.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2) as any
        frame.disposal = graphicControl.disposal = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2) as any
        graphicControl.userInput = Boolean(bits[6])
        graphicControl.transparent = Boolean(bits[7])
        // ↑ <Packed Fields>
        graphicControl.delayTime = readUint16LE()
        graphicControl.transparentIndex = readUint8()
        readBlock()

        frame.graphicControl = graphicControl
        frame.delay = (graphicControl.delayTime || 10) * 10
        continue
      }

      if (extensionFlag === EXTENSION_PLAIN_TEXT) {
        if (readUint8() !== EXTENSION_PLAIN_TEXT_BLOCK_SIZE) continue
        const plainText = {} as PlainText
        plainText.left = readUint16LE()
        plainText.top = readUint16LE()
        plainText.width = readUint16LE()
        plainText.height = readUint16LE()
        plainText.cellWidth = readUint8()
        plainText.cellHeight = readUint8()
        plainText.colorIndex = readUint8()
        plainText.backgroundColorIndex = readUint8()
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
