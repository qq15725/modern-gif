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
  // packed fields
  writeByte(
    0x80 // 1 : global color table flag = 1 (gct used)
    | 0x70 // 2-4 : color resolution = 7
    | 0x00 // 5 : gct sort flag = 0
    | (gif.palette?.length ?? 0), // 6-8 : gct size
  )
  writeByte(0) // background color index
  writeByte(0) // pixel aspect ratio - assume 1:1

  // Global Color Table TODO
  // writeBytes(gif.palette)
  // const n = (3 * 256) - gif.palette.length
  // for (let i = 0; i < n; i++) {
  //   writeByte(0)
  // }

  // Application extension
  writeByte(EXTENSION)
  writeByte(EXTENSION_APPLICATION)
  writeByte(EXTENSION_APPLICATION_BLOCK_SIZE)
  writeString('NETSCAPE2.0')
  writeByte(3)
  writeByte(1)
  writeUnsigned(0)
  writeByte(0)

  gif.frames.forEach((frame) => {
    // Graphic control extension
    writeByte(EXTENSION)
    writeByte(EXTENSION_GRAPHIC_CONTROL)
    writeByte(EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE)
    let transp, disp
    if (frame.graphicControl?.transparentIndex) {
      transp = 1
      disp = 2 // force clear if using transparent color
    } else {
      transp = 0
      disp = 0 // dispose = no action
    }
    if (frame.graphicControl && frame.graphicControl?.disposal >= 0) {
      disp = frame.graphicControl?.disposal & 7 // user override
    }
    disp <<= 2
    // packed fields
    writeByte(
      0 // 1:3 reserved
      | disp // 4:6 disposal
      | 0 // 7 user input - 0 = none
      | transp, // 8 transparency flag
    )
    writeUnsigned(frame.delay / 10)
    writeByte(frame.graphicControl?.transparentIndex ?? 0)
    writeByte(0)

    // Image descriptor
    writeByte(IMAGE_DESCRIPTOR)
    writeUnsigned(0)
    writeUnsigned(0)
    writeUnsigned(frame.width)
    writeUnsigned(frame.height)
    // packed fields
    if (frame.palette) {
      writeByte(
        0x80 // 1 local color table 1=yes
        | 0 // 2 interlace - 0=no
        | 0 // 3 sorted - 0=no
        | 0 // 4-5 reserved
        | frame.palette.length, // 6-8 size of color table
      )
    } else {
      writeByte(0)
    }

    // TODO
    // Local Color Table
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
