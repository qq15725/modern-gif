import type { RGB } from './gif'

export interface Reader {
  getCursor(): number
  setCursor(cursor: number): void

  readByte(): number
  readBytes(length: number): Uint8Array
  readString(length: number): string
  readUnsigned(): number
  readBits(): number[]
  readColorTable(length: number): RGB[]
  readSubBlock(): number[]
}

export function createReader(data: Uint8Array): Reader {
  let cursor = 0

  const getCursor = () => cursor
  const setCursor = (value: number) => cursor = value

  const readByte = (): number => data[cursor++]
  const readBytes = (length: number): Uint8Array => data.subarray(cursor, cursor += length)
  const readString = (length: number): string => Array.from(readBytes(length)).map(val => String.fromCharCode(val)).join('')
  const readUnsigned = (): number => new DataView(data.buffer.slice(cursor, cursor += 2)).getUint16(0, true)
  const readBits = (): number[] => readByte().toString(2).padStart(8, '0').split('').map(v => Number(v))
  const readColorTable = (length: number): RGB[] => Array.from({ length }, () => Array.from(readBytes(3)) as RGB)
  const readSubBlock = (): number[] => {
    const block: number[] = []
    while (true) {
      const val = readByte()
      if (val === 0 && data[cursor] !== 0) break
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
