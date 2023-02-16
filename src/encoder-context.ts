// [chunkIndex, chunkCursor]
export type EncoderContextCursor = [number, number]

export interface EncoderContext {
  getCursor(): EncoderContextCursor
  setCursor(cursor: EncoderContextCursor): void
  calculateDistance(cursor: EncoderContextCursor): number

  writeByte(value: number, cursor?: EncoderContextCursor): void
  writeBytes(value: number[]): void
  writeString(value: string): void
  writeUnsigned(value: number): void

  exportData(): Uint8Array
}
