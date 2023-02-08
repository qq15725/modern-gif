export function decode(buffer: ArrayBuffer) {
  let position = 0
  const data = new Uint8Array(buffer)

  // utils
  const readByte = () => data[position++]
  const readBytes = (length: number) => data.subarray(position, (position += length))
  const readString = (bytesLength: number) => Array.from(readBytes(bytesLength)).map(val => String.fromCharCode(val)).join('')
  const readUint16 = () => new Uint16Array(new Uint8Array(Array.from(readBytes(2))).buffer)[0]
  const byteToBits = (value: number) => value.toString(2).padStart(8, '0').split('').map(v => Number(v))

  const gif: Record<string, any> = {
    frames: [],
  }

  // 1. Header
  gif.signature = readString(3)
  gif.version = readString(3)

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

      // 4. Application Extension Label
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

    // 7. Image Descriptor.
    if (flag === 0x2C) {
      const frame: Record<string, any> = {}
      frame.x = readUint16()
      frame.y = readUint16()
      frame.width = readUint16()
      frame.height = readUint16()
      const packedFields = readByte()

      // <Packed Fields>
      const bits = packedFields.toString(2).padStart(8, '0').split('').map(v => Number(v))
      frame.localColorTableFlag = Boolean(bits[0])
      frame.interlaceFlag = Boolean(bits[1])
      frame.sortFlag = Boolean(bits[2])
      frame.reserved = new Uint16Array(new Uint8Array([bits[3], bits[4]]).buffer)[0]
      frame.sizeOfLocalColorTable = Math.pow(2, parseInt(`${ bits[5] }${ bits[6] }${ bits[7] }`, 2) + 1)

      // 8. Local Color Table
      frame.localColorTable = frame.localColorTableFlag
        ? Array.from({ length: frame.sizeOfLocalColorTable }, () => Array.from(readBytes(3)))
        : []

      // 9. Image Data
      frame.lzwMinimumCodeSize = readByte()

      while (true) {
        const val = readByte()
        if (!val) {
          break
        }
        readBytes(val)
      }

      gif.frames.push(frame)
      continue
    }

    // 10. Trailer Marker (end of file).
    if (flag === 0x3B) {
      break
    }

    console.warn(`Unknown gif block: 0x${ flag.toString(16) }`)
  }

  return gif
}
