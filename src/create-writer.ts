// [chunkIndex, chunkCursor]
export type WriterCursor = [number, number]

export function createWriter(options: { chunkSize?: number } = {}) {
  const {
    chunkSize = 4096,
  } = options

  let chunks: Uint8Array[] = [new Uint8Array(chunkSize)]
  let chunkIndex = 0
  let chunkCursor = 0

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

  return {
    getCursor: () => [chunkIndex, chunkCursor] as WriterCursor,
    setCursor: (cursor: WriterCursor) => {
      chunkIndex = cursor[0]
      chunkCursor = cursor[1]
    },
    calculateDistance: (cursor: WriterCursor) => (chunkIndex * chunkSize + chunkCursor) - (cursor[0] * chunkSize + cursor[1]),

    writeByte,
    writeBytes,
    writeString: (value: string) => value.split('').forEach((_, i) => writeByte(value.charCodeAt(i))),
    writeUnsigned: (value: number) => writeBytes([value & 0xFF, (value >> 8) & 0xFF]),

    flush: () => {
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
    },
  }
}
