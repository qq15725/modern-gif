import type { GifBuffer, RGB } from './gif'

export interface Reader {
  getCursor(): number
  setCursor(cursor: number): void

  readByte(): number
  readBytes(length: number): number[]
  readString(length: number): string
  readUnsigned(): number
  readBits(): number[]
  readColorTable(length: number): RGB[]
  readSubBlock(): number[]
}

export function createReader(data: GifBuffer): Reader {
  let view: DataView
  if (data instanceof ArrayBuffer) {
    view = new DataView(data)
  } else if (data instanceof DataView) {
    view = data
  } else {
    view = new DataView(data.buffer)
  }

  let cursor = 0

  const getCursor = () => cursor
  const setCursor = (value: number) => cursor = value

  const readByte = (): number => view.getUint8(cursor++)
  const readBytes = (length: number): number[] => [...new Array(length)].map(readByte)
  const readString = (length: number): string => String.fromCharCode(...readBytes(length))
  const readUnsigned = (): number => [view.getUint16(cursor, true), cursor += 2][0]
  const readBits = (): number[] => readByte().toString(2).padStart(8, '0').split('').map(v => Number(v))
  const readColorTable = (length: number): RGB[] => Array.from({ length }, () => Array.from(readBytes(3)) as RGB)
  const readSubBlock = (): number[] => {
    const block: number[] = []
    while (true) {
      const val = readByte()
      if (val === 0 && view.getUint8(cursor) !== 0) break
      block.push(val)
    }
    return block
  }

  return {
    getCursor,
    setCursor,

    readByte,
    readBytes,
    readString,
    readUnsigned,
    readBits,
    readColorTable,
    readSubBlock,
  }
}
