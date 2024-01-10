import { Writer } from '../Writer'
import { EXTENSION, EXTENSION_GRAPHIC_CONTROL, EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE, IMAGE_DESCRIPTOR } from '../utils'
import { lzwEncode } from '../lzw-encode'
import type { EncoderConfig } from '../Encoder'
import type { EncodingFrame } from '../types'

export class EncodeIndexdFrame implements ReadableWritablePair<Uint8Array, EncodingFrame> {
  protected _rsControler!: ReadableStreamDefaultController<Uint8Array>

  readable = new ReadableStream<Uint8Array>({
    start: controler => this._rsControler = controler,
  })

  writable = new WritableStream<EncodingFrame>({
    write: frame => {
      const writer = new Writer()

      const {
        left = 0,
        top = 0,
        width = 0,
        height = 0,
        delay = 100,
        colorTable,
      } = frame

      let {
        disposal = 0,
      } = frame

      const transparent = frame.graphicControl?.transparent
      let transparentIndex = frame.graphicControl?.transparentIndex ?? 255

      if (left < 0 || left > 65535) throw new Error('Left invalid.')
      if (top < 0 || top > 65535) throw new Error('Top invalid.')
      if (width <= 0 || width > 65535) throw new Error('Width invalid.')
      if (height <= 0 || height > 65535) throw new Error('Height invalid.')

      // color table
      let minCodeSize = 8
      let colorTableLength = colorTable ? colorTable.length : 0
      if (colorTableLength) {
        if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & (colorTableLength - 1)) {
          throw new Error('Invalid color table length, must be power of 2 and 2 .. 256.')
        }
        // eslint-disable-next-line no-cond-assign
        while (colorTableLength >>= 1) ++minCodeSize
        // colorTableLength = 1 << minCodeSize // Now we can easily get it back.
      }

      // Graphic control extension
      writer.writeByte(EXTENSION) // extension introducer
      writer.writeByte(EXTENSION_GRAPHIC_CONTROL) // GCE label
      writer.writeByte(EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) // block size
      if (transparent) {
        if (!disposal) {
          disposal = 2 // force clear if using transparent color
        }
      } else {
        transparentIndex = 0
      }
      // <Packed Fields>
      // 1-3 : reserved = 0
      // 4-6 : disposal
      // 7   : user input flag = 0
      // 8   : transparency flag
      writer.writeByte(parseInt(`000${ Number(disposal & 7).toString(2).padStart(3, '0') }0${ transparent ? 1 : 0 }`, 2))
      writer.writeUnsigned(delay / 10) // delay x 1/100 sec
      writer.writeByte(transparentIndex) // transparent color index
      writer.writeByte(0) // block terminator

      // Image descriptor
      writer.writeByte(IMAGE_DESCRIPTOR) // image separator
      writer.writeUnsigned(left) // image position
      writer.writeUnsigned(top)
      writer.writeUnsigned(width) // image size
      writer.writeUnsigned(height)
      // <Packed Fields>
      if (colorTable?.length) {
        // 1   : local color table = 1
        // 2   : interlace = 0
        // 3   : sorted = 0
        // 4-5 : reserved = 0
        // 6-8 : local color table size
        writer.writeByte(parseInt(`10000${ (minCodeSize - 1).toString(2).padStart(3, '0') }`, 2))

        // Local Color Table
        writer.writeBytes(colorTable.flat())
      } else {
        writer.writeByte(0)
      }

      // LZW
      lzwEncode(minCodeSize, frame.data, writer)

      this._rsControler.enqueue(writer.toUint8Array())
    },
    close: () => this._rsControler.close(),
  })

  constructor(
    protected _config: EncoderConfig,
  ) {
    //
  }
}
