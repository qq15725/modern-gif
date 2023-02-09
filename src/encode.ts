import {
  EXTENSION,
  EXTENSION_APPLICATION,
  EXTENSION_APPLICATION_BLOCK_SIZE,
  EXTENSION_GRAPHIC_CONTROL,
  EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE,
  IMAGE_DESCRIPTOR,
  SIGNATURE,
  TRAILER,
} from './utils'
import type { GIF } from './types'

export function encode(options: Partial<GIF>): Uint8Array {
  const gif = {
    version: '89a',
    palette: [] as any,
    ...options,
  } as GIF

  const chunks: Uint8Array[] = []
  const chunkSize = 4096
  let chunkCursor = 0
  let cursor = 0

  // utils
  const addChunk = () => {
    chunks[chunkCursor++] = new Uint8Array(chunkSize)
    cursor = 0
  }
  const writeByte = (val: number) => {
    if (cursor >= chunkSize) addChunk()
    chunks[chunkCursor][cursor++] = val
  }
  const writeBytes = (val: number[]) => val.forEach(writeByte)
  const writeString = (val: string) => val.split('').forEach((_, i) => writeByte(val.charCodeAt(i)))
  const writeUnsigned = (val: number) => writeBytes([val & 0xFF, (val >> 8) & 0xFF])

  // Header
  writeString(SIGNATURE)
  writeString(gif.version)

  // Logical Screen Descriptor
  writeUnsigned(gif.width)
  writeUnsigned(gif.height)
  // <Packed Fields>
  // 1   : global color table flag = 1 (gct used)
  // 2-4 : color resolution = 7
  // 5   : gct sort flag = 0
  // 6-8 : gct size = 7
  writeByte(parseInt('11110111', 2))
  writeByte(0) // background color index
  writeByte(0) // pixel aspect ratio - assume 1:1

  // Global Color Table
  writeBytes(gif.palette?.flat() ?? [])
  const n = (3 * 256) - (gif.palette?.length ?? 0)
  for (let i = 0; i < n; i++) {
    writeByte(0)
  }

  // Application extension
  writeByte(EXTENSION) // extension introducer
  writeByte(EXTENSION_APPLICATION) // app extension label
  writeByte(EXTENSION_APPLICATION_BLOCK_SIZE) // block size
  writeString('NETSCAPE2.0') // app id + auth code
  writeByte(3) // sub-block size
  writeByte(1) // loop sub-block id
  writeUnsigned(gif.loop) // loop count (extra iterations, 0=repeat forever)
  writeByte(0) // block terminator

  gif.frames.forEach((frame) => {
    // Graphic control extension
    writeByte(EXTENSION) // extension introducer
    writeByte(EXTENSION_GRAPHIC_CONTROL) // GCE label
    writeByte(EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE) // block size
    let hasTransparentIndex, disposal
    if (frame.graphicControl?.transparentIndex) {
      hasTransparentIndex = 1
      disposal = 2 // force clear if using transparent color
    } else {
      hasTransparentIndex = 0
      disposal = 0 // dispose = no action
    }
    if (frame.graphicControl && frame.graphicControl?.disposal >= 0) {
      disposal = frame.graphicControl?.disposal & 7 // user override
    }
    // <Packed Fields>
    // 1-3 : reserved = 0
    // 4-6 : disposal
    // 7   : user input flag = 0
    // 8   : transparency flag
    writeByte(parseInt(`000${ Number(disposal).toString(2).padStart(3, '0') }0${ hasTransparentIndex }`, 2))
    writeUnsigned(frame.delay / 10) // delay x 1/100 sec
    writeByte(frame.graphicControl?.transparentIndex ?? 0) // transparent color index
    writeByte(0) // block terminator

    // Image descriptor
    writeByte(IMAGE_DESCRIPTOR) // image separator
    writeUnsigned(0) // image position x,y = 0,0
    writeUnsigned(0)
    writeUnsigned(frame.width) // image size
    writeUnsigned(frame.height)
    // <Packed Fields>
    if (frame.palette?.length) {
      // 1   : local color table = 1
      // 2   : interlace = 0
      // 3   : sorted = 0
      // 4-5 : reserved = 0
      // 6-8 : size of color table = 7
      writeByte(parseInt('10000111', 2))

      // Local Color Table
      writeBytes(frame.palette.flat())
      const n = (3 * 256) - (frame.palette.length)
      for (let i = 0; i < n; i++) {
        writeByte(0)
      }
    } else {
      writeByte(0)
    }

    // TODO
    // Image Data
  })

  // Trailer
  writeByte(TRAILER)

  const dataView = new Uint8Array(chunks.map(chunk => chunk.byteLength))
  let offset = 0
  chunks.forEach(chunk => {
    dataView.set(chunk, offset)
    offset += chunk.byteLength
  })
  return dataView
}
