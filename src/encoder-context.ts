// [chunkIndex, chunkCursor]
export type EncoderContextCursor = [number, number]

export interface EncoderContext {
  getCursor(): EncoderContextCursor
  setCursor(cursor: EncoderContextCursor): void
  calculateDistance(cursor: EncoderContextCursor): number

  writeUint8(value: number, cursor?: EncoderContextCursor): void
  writeUint8Bytes(value: number[]): void
  writeUTFBytes(value: string): void
  writeUint16LE(value: number): void

  exportData(): Uint8Array
}
