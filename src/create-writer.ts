// [chunkIndex, chunkCursor]
export type WriterCursor = [number, number]

export interface Writer {
  getCursor(): WriterCursor
  setCursor(cursor: WriterCursor): void
  calculateDistance(cursor: WriterCursor): number

  writeByte(value: number, cursor?: WriterCursor): void
  writeBytes(value: Uint8Array | number[]): void
  writeUnsigned(value: number): void
  writeString(value: string): void

  flush(): Uint8Array
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
  const writeByte = (val: number, cursor?: WriterCursor) => {
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
  const writeBytes = (value: number[] | Uint8Array) => value.forEach(val => writeByte(val))
  const writeString = (value: string) => value.split('').forEach((_, i) => writeByte(value.charCodeAt(i)))
  const writeUnsigned = (value: number) => writeBytes([value & 0xFF, (value >> 8) & 0xFF])

  const flush = () => {
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

    writeByte,
    writeBytes,
    writeString,
    writeUnsigned,

    flush,
  }
}
