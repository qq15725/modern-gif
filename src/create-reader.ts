import { resovleDataView } from './utils'

export function createReader(data: BufferSource) {
  const view = resovleDataView(data)

  let cursor = 0

  const readByte = (): number => view.getUint8(cursor++)
  const readBytes = (length: number): number[] => Array.from({ length }).map(readByte)

  return {
    getCursor: () => cursor,
    setCursor: (value: number) => cursor = value,

    readByte,
    readBytes,
    readString: (length: number): string => String.fromCharCode(...readBytes(length)),
    readUnsigned: (): number => [view.getUint16(cursor, true), cursor += 2][0],
    readBits: (): number[] => view.getUint8(cursor++).toString(2).padStart(8, '0').split('').map(Number),
    readColorTable: (length: number) => Array.from({ length }, () => Array.from(readBytes(3))),
    readSubBlock: (): number[] => {
      const block: number[] = []
      while (true) {
        const val = readByte()
        if (val === 0 && view.getUint8(cursor) !== 0) break
        block.push(val)
      }
      return block
    },
  }
}
