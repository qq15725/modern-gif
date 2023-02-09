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
import { lzwDecode } from './lzw'
import { deinterlace } from './deinterlace'
import type { Application, Frame, GIF, GraphicControl, PlainText } from './types'

export function decode(dataView: Uint8Array): GIF {
  const gif = {
    frames: [] as Frame[],
  } as GIF

  let cursor = 0

  // utils
  const readByte = () => dataView[cursor++]
  const readBytes = (length: number) => dataView.subarray(cursor, cursor += length)
  const readString = (bytesLength: number) => Array.from(readBytes(bytesLength)).map(val => String.fromCharCode(val)).join('')
  const readUnsigned = () => new Uint16Array(dataView.buffer.slice(cursor, cursor += 2))[0]
  const readData = () => {
    let str = ''
    while (true) {
      const val = readByte()
      if (val === 0 && dataView[cursor] !== 0) break
      str += String.fromCharCode(val)
    }
    return str
  }
  const byteToBits = (value: number) => value.toString(2).padStart(8, '0').split('').map(v => Number(v))

  // Header
  const signature = readString(3)
  const version = readString(3)
  if (signature !== SIGNATURE || !VERSIONS.includes(version)) {
    throw new Error(`This is not a gif file, signature: ${ signature } version: ${ version }`)
  }
  gif.version = version as any

  // Logical Screen Descriptor
  gif.width = readUnsigned()
  gif.height = readUnsigned()
  const packedFields = readByte()
  const backgroundColorIndex = readByte()
  gif.pixelAspectRatio = readByte()

  // <Packed Fields>
  const bits = byteToBits(packedFields)
  const hasPalette = Boolean(bits[0])
  gif.colorResoluTion = parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1

  // Global Color Table
  if (hasPalette) {
    const length = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)
    gif.palette = Array.from({ length }, () => Array.from(readBytes(3)))
    gif.paletteIsSorted = Boolean(bits[4])
    gif.backgroundColor = gif.palette[backgroundColorIndex]
  }

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
      const packedFields = readByte()

      // <Packed Fields>
      const bits = packedFields.toString(2).padStart(8, '0').split('').map(v => Number(v))
      const hasPalette = Boolean(bits[0])
      frame.interlaced = Boolean(bits[1])
      frame.reserved = new Uint16Array(new Uint8Array([bits[3], bits[4]]).buffer)[0]

      // Local Color Table
      if (hasPalette) {
        const length = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)
        frame.palette = Array.from({ length }, () => Array.from(readBytes(3)))
        frame.paletteIsSorted = Boolean(bits[2])
      }

      // Image Data
      frame.minCodeSize = readByte()
      frame.image = []
      while (true) {
        const byteLength = readByte()
        if (byteLength === 0) break
        frame.image.push({
          begin: cursor,
          end: cursor += byteLength,
        })
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
        application.authenticationCode = readString(3)
        application.data = readData()
        frame.application = application
        continue
      }

      if (extensionFlag === EXTENSION_COMMENT) {
        frame.comment = readData()
        continue
      }

      if (extensionFlag === EXTENSION_GRAPHIC_CONTROL) {
        if (readByte() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) continue
        const graphicControl = {} as GraphicControl
        const packedFields = readByte()
        graphicControl.delay = readUnsigned()
        const transparentIndex = readByte()
        readData()

        // <Packed Fields>
        const bits = byteToBits(packedFields)
        graphicControl.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2)
        graphicControl.disposal = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2) as any
        graphicControl.userInput = Boolean(bits[6])
        const hasTransparentIndex = Boolean(bits[7])

        if (hasTransparentIndex) {
          graphicControl.transparentIndex = transparentIndex
        }

        frame.graphicControl = graphicControl
        frame.delay = (graphicControl.delay || 10) * 10
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
        plainText.data = readData()
        frame.plainText = plainText
        continue
      }

      console.warn(`Unknown gif extension block: 0x${ extensionFlag.toString(16) }`)
      continue
    }

    if (flag === TRAILER) break

    console.warn(`Unknown gif block: 0x${ flag.toString(16) }`)
  }

  gif.readFrame = (index: number) => readFrame(dataView, gif, index)

  return gif
}

export function readFrame(dataView: Uint8Array, gif: GIF, index: number) {
  const frame = gif.frames[index]
  if (!frame) {
    throw new Error(`This index is abnormal. index: ${ index }`)
  }
  const {
    image,
    width,
    height,
    palette = gif.palette,
    minCodeSize,
    interlaced,
  } = frame
  const imageDataView = new Uint8Array(
    image.reduce((total, { begin, end }) => total + (end - begin), 0),
  )
  let offset = 0
  image.forEach(({ begin, end }) => {
    const subBlockView = dataView.subarray(begin, end)
    imageDataView.set(subBlockView, offset)
    offset += subBlockView.byteLength
  })
  let indexes = lzwDecode(minCodeSize, imageDataView, width * height)
  if (interlaced) {
    indexes = deinterlace(indexes, width)
  }
  const pixels = new Uint8ClampedArray(width * height * 4)
  indexes.forEach((colorIndex, index) => {
    const color = palette?.[colorIndex] ?? [0, 0, 0]
    index *= 4
    pixels[index] = color[0]
    pixels[index + 1] = color[1]
    pixels[index + 2] = color[2]
    pixels[index + 3] = colorIndex === frame.graphicControl?.transparentIndex ? 0 : 255
  })
  return new ImageData(pixels, width, height)
}
