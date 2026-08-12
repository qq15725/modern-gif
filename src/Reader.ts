import { resovleSource } from './utils'

export class Reader {
  protected _view: DataView
  offset = 0

  constructor(
    source: CanvasImageSource | BufferSource,
  ) {
    this._view = resovleSource(source, 'dataView')
  }

  readByte(): number {
    return this._view.getUint8(this.offset++)
  }

  readBytes(length: number): Array<number> {
    return Array.from({ length }).map(() => this.readByte())
  }

  readString(length: number): string {
    return String.fromCharCode(...this.readBytes(length))
  }

  readUnsigned(): number {
    return [this._view.getUint16(this.offset, true), this.offset += 2][0]
  }

  readBits(): number[] {
    return this._view.getUint8(this.offset++).toString(2).padStart(8, '0').split('').map(Number)
  }

  readColorTable(length: number): Array<Array<number>> {
    return Array.from({ length }, () => Array.from(this.readBytes(3)))
  }

  readSubBlock(): number[] {
    const block: number[] = []
    while (true) {
      const length = this.readByte()
      if (length === 0)
        break
      for (let i = 0; i < length; i++) {
        block.push(this.readByte())
      }
    }
    return block
  }
}
