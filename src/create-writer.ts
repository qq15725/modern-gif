// [chunkIndex, chunkCursor]
export type WriterCursor = [number, number]

export interface Writer {
  getCursor(): WriterCursor
  setCursor(cursor: WriterCursor): void
  calculateDistance(cursor: WriterCursor): number

  writeUint8(value: number, cursor?: WriterCursor): void
  writeUint8Bytes(value: Uint8Array | number[]): void
  writeUTFBytes(value: string): void
  writeUint16LE(value: number): void

  exportUint8Array(): Uint8Array
}

export function createWriter(options: { chunkSize?: number } = {}): Writer {
  const {
    chunkSize = 4096,
  } = options

  let chunks: Uint8Array[] = [new Uint8Array(chunkSize)]
  let chunkIndex = 0
  let chunkCursor = 0

  const getCursor = () => [chunkIndex, chunkCursor] as WriterCursor
  const setCursor = (cursor: WriterCursor) => {
    chunkIndex = cursor[0]
    chunkCursor = cursor[1]
  }
  const calculateDistance = (cursor: WriterCursor) => (chunkIndex * chunkSize + chunkCursor) - (cursor[0] * chunkSize + cursor[1])
  const writeUint8 = (val: number, cursor?: WriterCursor) => {
    if (cursor) {
      chunks[cursor[0]][cursor[1]] = val
    } else {
      if (chunkCursor >= chunkSize) {
        chunks[++chunkIndex] = new Uint8Array(chunkSize)
        chunkCursor = 0
      }
      chunks[chunkIndex][chunkCursor++] = val
    }
  }
  const writeUint8Bytes = (value: number[] | Uint8Array) => value.forEach(val => writeUint8(val))
  const writeUTFBytes = (value: string) => value.split('').forEach((_, i) => writeUint8(value.charCodeAt(i)))
  const writeUint16LE = (value: number) => writeUint8Bytes([value & 0xFF, (value >> 8) & 0xFF])

  const exportUint8Array = () => {
    chunks[chunkIndex] = chunks[chunkIndex].slice(0, chunkCursor)

    const data = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))

    let offset = 0
    chunks.forEach(chunk => {
      data.set(chunk, offset)
      offset += chunk.byteLength
    })

    chunks = [new Uint8Array(chunkSize)]
    chunkIndex = 0
    chunkCursor = 0

    return data
  }

  return {
    getCursor,
    setCursor,
    calculateDistance,

    writeUint8,
    writeUint8Bytes,
    writeUTFBytes,
    writeUint16LE,

    exportUint8Array,
  }
}
