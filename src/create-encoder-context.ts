import type { EncoderContext, EncoderContextCursor } from './encoder-context'

export function createEncoderContext(options: { chunkSize?: number } = {}): EncoderContext {
  const {
    chunkSize = 4096,
  } = options

  let chunks: Uint8Array[] = [new Uint8Array(chunkSize)]
  let chunkIndex = 0
  let chunkCursor = 0

  const getCursor = () => [chunkIndex, chunkCursor] as EncoderContextCursor
  const setCursor = (cursor: EncoderContextCursor) => {
    chunkIndex = cursor[0]
    chunkCursor = cursor[1]
  }
  const calculateDistance = (cursor: EncoderContextCursor) => (chunkIndex * chunkSize + chunkCursor) - (cursor[0] * chunkSize + cursor[1])
  const writeByte = (val: number, cursor?: EncoderContextCursor) => {
    if (cursor) {
      chunks[cursor[0]][cursor[1]] = val
    } else {
      if (chunkCursor >= chunkSize) {
        chunks[chunkIndex++] = new Uint8Array(chunkSize)
        chunkCursor = 0
      }
      chunks[chunkIndex][chunkCursor++] = val
    }
  }
  const writeBytes = (value: number[]) => value.forEach(val => writeByte(val))
  const writeString = (value: string) => value.split('').forEach((_, i) => writeByte(value.charCodeAt(i)))
  const writeUnsigned = (value: number) => writeBytes([value & 0xFF, (value >> 8) & 0xFF])
  const exportData = () => {
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

    exportData,
  }
}
