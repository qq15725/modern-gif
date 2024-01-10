export type WriterCursor = [number, number]

export class Writer {
  protected _chunks: Array<DataView>
  protected _chunkIndex = 0
  protected _chunkOffset = 0

  get cursor(): WriterCursor {
    return [this._chunkIndex, this._chunkOffset]
  }

  constructor(
    protected _chunkByteLength = 4096,
  ) {
    this._chunks = [this._createChunk()]
  }

  protected _createChunk(): DataView {
    return new DataView(new ArrayBuffer(this._chunkByteLength))
  }

  writeByte(val: number, cursor?: WriterCursor): void {
    if (cursor) {
      this._chunks[cursor[0]].setUint8(cursor[1], val)
    } else {
      if (this._chunkOffset >= this._chunkByteLength) {
        this._chunks[++this._chunkIndex] = this._createChunk()
        this._chunkOffset = 0
      }
      this._chunks[this._chunkIndex].setUint8(this._chunkOffset++, val)
    }
  }

  writeBytes(value: number[] | Uint8Array): void {
    value.forEach(val => this.writeByte(val))
  }

  writeString(value: string): void {
    value.split('').forEach(char => {
      this.writeByte(char.charCodeAt(0))
    })
  }

  writeUnsigned(value: number): void {
    this.writeBytes([value & 0xFF, (value >> 8) & 0xFF])
  }

  calculateDistance(cursor: WriterCursor): number {
    return (this._chunkIndex * this._chunkByteLength + this._chunkOffset) - (cursor[0] * this._chunkByteLength + cursor[1])
  }

  toUint8Array(): Uint8Array {
    this._chunks[this._chunkIndex] = new DataView(this._chunks[this._chunkIndex].buffer.slice(0, this._chunkOffset))
    const data = new Uint8Array(this._chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
    let offset = 0
    this._chunks.forEach(chunk => {
      data.set(new Uint8Array(chunk.buffer), offset)
      offset += chunk.byteLength
    })
    this._chunks = [this._createChunk()]
    this._chunkIndex = 0
    this._chunkOffset = 0
    return data
  }
}
