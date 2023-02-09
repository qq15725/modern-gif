import type { GIF, GIFSpecBlock } from './types'

export function decode(data: ArrayBuffer, offset = 0): GIF {
  const view = new Uint8Array(data)
  const gif = {} as GIF
  gif.blocks = [] as any

  // utils
  const readByte = () => view[offset++]
  const readBytes = (length: number) => view.subarray(offset, offset += length)
  const readString = (bytesLength: number) => Array.from(readBytes(bytesLength)).map(val => String.fromCharCode(val)).join('')
  const readUint16 = () => new Uint16Array(data.slice(offset, offset += 2))[0]
  const byteToBits = (value: number) => value.toString(2).padStart(8, '0').split('').map(v => Number(v))

  // 1. Header
  gif.signature = readString(3) as 'GIF'
  gif.version = readString(3) as '87a' | '89a'

  // 2. Logical Screen Descriptor
  gif.width = readUint16()
  gif.height = readUint16()
  const packedFields = readByte()
  gif.backgroundColorIndex = readByte()
  gif.pixelAspectRatio = readByte()

  // <Packed Fields>
  const bits = byteToBits(packedFields)
  gif.globalColorTableFlag = Boolean(bits[0])
  gif.colorResoluTion = parseInt(`${ bits[1] }${ bits[2] }${ bits[3] }`, 2) + 1
  gif.sortFlag = Boolean(bits[4])
  gif.sizeOfGlobalColorTable = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)

  // 3. Global Color Table
  gif.globalColorTable = gif.globalColorTableFlag
    ? Array.from({ length: gif.sizeOfGlobalColorTable }, () => Array.from(readBytes(3)))
    : []

  while (true) {
    const flag = readByte()

    if (flag === 0x21) {
      const label = readByte()

      // 4. Application Extension
      if (label === 0xFF) {
        // Length of Application Block
        // (eleven bytes of data to follow)
        readByte()
        // "NETSCAPE"
        readString(8)
        // "2.0"
        readString(3)
        // Length of Data Sub-Block
        // (three bytes of data to follow)
        readByte()
        //
        readByte()
        // 0 to 65535, an unsigned integer in
        // little-endian byte format. This specifies the
        // number of times the loop should
        // be executed.
        readBytes(2)
        // Data Sub-Block Terminator.
        readByte()
        continue
      }

      // 5. Graphic Control Extension
      if (label === 0xF9) {
        gif.blockSize = readByte()
        const packedFields = readByte()
        gif.delayTime = readUint16()
        gif.transparentColorIndex = readByte()
        // Block terminator
        readByte()

        // <Packed Fields>
        const bits = byteToBits(packedFields)
        gif.reserved = parseInt(`${ bits[0] }${ bits[1] }${ bits[2] }`, 2)
        gif.disposalMethod = parseInt(`${ bits[3] }${ bits[4] }${ bits[5] }`, 2)
        gif.userInputFlag = Boolean(bits[6])
        gif.transparentColorFlag = Boolean(bits[7])
        continue
      }

      // 6. Comment Extension
      if (label === 0xFE) {
        gif.commentData = ''
        while (true) {
          const val = readByte()
          if (val === 0) {
            break
          }
          gif.commentData += String.fromCharCode(val)
        }
        continue
      }

      console.warn(`Unknown graphic control label: 0x${ label.toString(16) }`)
      continue
    }

    // 7. Image Descriptor
    if (flag === 0x2C) {
      const block = {} as GIFSpecBlock
      block.imageLeftPosition = readUint16()
      block.imageRightPosition = readUint16()
      block.imageWidth = readUint16()
      block.imageHeight = readUint16()
      const packedFields = readByte()

      // <Packed Fields>
      const bits = packedFields.toString(2).padStart(8, '0').split('').map(v => Number(v))
      block.localColorTableFlag = Boolean(bits[0])
      block.interlaceFlag = Boolean(bits[1])
      block.sortFlag = Boolean(bits[2])
      block.reserved = new Uint16Array(new Uint8Array([bits[3], bits[4]]).buffer)[0]
      block.sizeOfLocalColorTable = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)

      // 8. Local Color Table
      block.localColorTable = block.localColorTableFlag
        ? Array.from({ length: block.sizeOfLocalColorTable }, () => Array.from(readBytes(3)))
        : []

      // 9. Image Data
      block.lzwMinimumCodeSize = readByte()
      block.imageData = []
      while (true) {
        const byteLength = readByte()
        if (!byteLength) {
          break
        }
        block.imageData.push({
          begin: offset,
          end: offset += byteLength,
        })
      }

      gif.blocks.push(block)
      continue
    }

    // 10. Trailer Marker (end of file)
    if (flag === 0x3B) {
      break
    }

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
