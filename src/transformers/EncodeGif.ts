import {
  EXTENSION,
  EXTENSION_APPLICATION,
  EXTENSION_APPLICATION_BLOCK_SIZE,
  SIGNATURE,
  TRAILER,
  mergeBuffers,
} from '../utils'
import { Writer } from '../Writer'
import type { EncoderConfig } from '../Encoder'

export class EncodeGif implements ReadableWritablePair<Uint8Array, Uint8Array> {
  protected _rsControler!: ReadableStreamDefaultController<Uint8Array>
  protected _frames: Array<Uint8Array> = []

  readable = new ReadableStream<Uint8Array>({
    start: controler => this._rsControler = controler,
  })

  writable = new WritableStream<Uint8Array>({
    write: (frame) => {
      this._frames.push(frame)
    },
    close: () => {
      const header = this._encodeHeader()
      const body = mergeBuffers(this._frames)
      const output = new Uint8Array(header.length + body.byteLength + 1)
      output.set(header)
      output.set(body, header.byteLength)
      output[output.length - 1] = TRAILER
      this._rsControler.enqueue(output)
      this._rsControler.close()
      this._frames.length = 0
    },
  })

  constructor(
    protected _config: EncoderConfig,
  ) {
    //
  }

  protected _encodeHeader() {
    const gif = {
      version: '89a',
      looped: true,
      loopCount: 0,
      pixelAspectRatio: 0,
      ...this._config,
    }

    if (gif.width <= 0 || gif.width > 65535) throw new Error('Width invalid.')
    if (gif.height <= 0 || gif.height > 65535) throw new Error('Height invalid.')

    // Handling of global color table size
    let colorTableSize = 0
    if (gif.colorTable?.length) {
      let colorTableLength = gif.colorTable.length
      if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & (colorTableLength - 1)) {
        throw new Error('Invalid color table length, must be power of 2 and 2 .. 256.')
      }
      // eslint-disable-next-line no-cond-assign
      while (colorTableLength >>= 1) ++colorTableSize
      colorTableLength = 1 << colorTableSize
      gif.colorTableSize = --colorTableSize
      if (gif.backgroundColorIndex >= colorTableLength) {
        throw new Error('Background index out of range.')
      }
      if (gif.backgroundColorIndex === 0) {
        throw new Error('Background index explicitly passed as 0.')
      }
    }

    // max length 32 + 256 * 3
    const writer = new Writer()

    // Header
    writer.writeString(SIGNATURE)
    writer.writeString(gif.version)

    // Logical Screen Descriptor
    writer.writeUnsigned(gif.width)
    writer.writeUnsigned(gif.height)
    // <Packed Fields>
    // 1   : global color table flag = 1
    // 2-4 : color resolution = 7
    // 5   : global color table sort flag = 0
    // 6-8 : global color table size
    writer.writeByte(parseInt(`${ gif.colorTableSize ? 1 : 0 }1110${ gif.colorTableSize.toString(2).padStart(3, '0') }`, 2))
    writer.writeByte(gif.backgroundColorIndex) // background color index
    writer.writeByte(gif.pixelAspectRatio) // pixel aspect ratio - assume 1:1

    // Global Color Table
    writer.writeBytes(gif.colorTable?.flat() ?? [])

    // Netscape block
    if (gif.looped) {
      writer.writeByte(EXTENSION) // extension introducer
      writer.writeByte(EXTENSION_APPLICATION) // app extension label
      writer.writeByte(EXTENSION_APPLICATION_BLOCK_SIZE) // block size
      writer.writeString('NETSCAPE2.0') // app id + auth code
      writer.writeByte(3) // sub-block size
      writer.writeByte(1) // loop sub-block id
      writer.writeUnsigned(gif.loopCount) // loop count (extra iterations, 0=repeat forever)
      writer.writeByte(0) // block terminator
    }

    return writer.toUint8Array()
  }
}
