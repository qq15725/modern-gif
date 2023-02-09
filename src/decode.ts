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
import type { Application, GIF, GIFSpecBlock, GraphicControl, PlainText } from './types'

export function decode(data: ArrayBuffer, offset = 0): GIF {
  const view = new Uint8Array(data)
  const gif = {} as GIF
  gif.blocks = [] as any

  // utils
  const readByte = () => view[offset++]
  const readBytes = (length: number) => view.subarray(offset, offset += length)
  const readString = (bytesLength: number) => Array.from(readBytes(bytesLength)).map(val => String.fromCharCode(val)).join('')
  const readUnsigned = () => new Uint16Array(data.slice(offset, offset += 2))[0]
  const readData = () => {
    let str = ''
    while (true) {
      const val = readByte()
      if (val === 0 && view[offset] !== 0) break
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
  gif.backgroundColorIndex = readByte()
  gif.pixelAspectRatio = readByte()

  // <Packed Fields>
  const bits = byteToBits(packedFields)
  const hasColors = Boolean(bits[0])
  gif.colorResoluTion = parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1
  gif.sortFlag = Boolean(bits[4])

  // Global Color Table
  if (hasColors) {
    gif.colors = Array.from({
      length: Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1),
    }, () => Array.from(readBytes(3)))
  }

  let block = {} as GIFSpecBlock
  while (true) {
    const flag = readByte()

    if (flag === IMAGE_DESCRIPTOR) {
      block.left = readUnsigned()
      block.top = readUnsigned()
      block.width = readUnsigned()
      block.height = readUnsigned()
      const packedFields = readByte()

      // <Packed Fields>
      const bits = packedFields.toString(2).padStart(8, '0').split('').map(v => Number(v))
      const hasColors = Boolean(bits[0])
      block.interlaceFlag = Boolean(bits[1])
      block.sortFlag = Boolean(bits[2])
      block.reserved = new Uint16Array(new Uint8Array([bits[3], bits[4]]).buffer)[0]

      // Local Color Table
      if (hasColors) {
        block.colors = Array.from({
          length: Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1),
        }, () => Array.from(readBytes(3)))
      }

      // Image Data
      block.lzwMinimumCodeSize = readByte()
      block.imageData = []
      while (true) {
        const byteLength = readByte()
        if (byteLength === 0) break
        block.imageData.push({
          begin: offset,
          end: offset += byteLength,
        })
      }

      gif.blocks.push(block)
      block = {} as GIFSpecBlock
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
        block.application = application
        continue
      }

      if (extensionFlag === EXTENSION_COMMENT) {
        block.comment = readData()
        continue
      }

      if (extensionFlag === EXTENSION_GRAPHIC_CONTROL) {
        if (readByte() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) continue
        const graphicControl = {} as GraphicControl
        const packedFields = readByte()
        graphicControl.delayTime = readUnsigned()
        graphicControl.transparentColorIndex = readByte()
        graphicControl.data = readData()

        // <Packed Fields>
        const bits = byteToBits(packedFields)
        graphicControl.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2)
        graphicControl.disposalMethod = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2)
        graphicControl.userInputFlag = Boolean(bits[6])
        graphicControl.transparentColorFlag = Boolean(bits[7])
        block.graphicControl = graphicControl
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
        block.plainText = plainText
        continue
      }

      console.warn(`Unknown gif extension block: 0x${ extensionFlag.toString(16) }`)
      continue
    }

    if (flag === TRAILER) break

    console.warn(`Unknown gif block: 0x${ flag.toString(16) }`)
  }

  gif.read = () => {
    return gif.blocks.map(block => {
      const { imageData } = block
      const imageDataView = new Uint8Array(
        imageData.reduce((total, { begin, end }) => total + (end - begin), 0),
      )
      let offset = 0
      imageData.forEach(({ begin, end }) => {
        const subBlockView = view.subarray(begin, end)
        imageDataView.set(subBlockView, offset)
        offset += subBlockView.byteLength
      })
      return imageDataView
    })
  }

  return gif
}
