import type { Writer } from './Writer'

export function lzwEncode(minCodeSize: number, data: ArrayLike<number>, writer: Writer): void {
  writer.writeByte(minCodeSize)
  let curSubblock = writer.cursor
  writer.writeByte(0)
  const clearCode = 1 << minCodeSize
  const codeMask = clearCode - 1
  const eoiCode = clearCode + 1
  let nextCode = eoiCode + 1
  let curCodeSize = minCodeSize + 1
  let curShift = 0
  let cur = 0

  function emitBytesToBuffer(bitBlockSize: number): void {
    while (curShift >= bitBlockSize) {
      writer.writeByte(cur & 0xFF)
      cur >>= 8
      curShift -= 8
      if (writer.calculateDistance(curSubblock) === 256) {
        writer.writeByte(255, curSubblock)
        curSubblock = writer.cursor
        writer.writeByte(0)
      }
    }
  }

  function emitCode(c: number): void {
    cur |= c << curShift
    curShift += curCodeSize
    emitBytesToBuffer(8)
  }

  let ibCode = data[0] & codeMask // Load first input index.
  let codeTable: Record<number, number> = { } // Key'd on our 20-bit "tuple".
  let curKey: number
  let curCode: number
  let k: number
  emitCode(clearCode) // Spec says first code should be a clear code.
  for (let len = data.length, i = 1; i < len; ++i) {
    k = data[i] & codeMask
    curKey = ibCode << 8 | k // (prev, k) unique tuple.
    curCode = codeTable[curKey] // buffer + k.
    if (curCode === undefined) {
      cur |= ibCode << curShift
      curShift += curCodeSize
      while (curShift >= 8) {
        writer.writeByte(cur & 0xFF)
        cur >>= 8
        curShift -= 8
        if (writer.calculateDistance(curSubblock) === 256) {
          writer.writeByte(255, curSubblock)
          curSubblock = writer.cursor
          writer.writeByte(0)
        }
      }
      if (nextCode === 4096) {
        // Table full, need a clear.
        emitCode(clearCode)
        nextCode = eoiCode + 1
        curCodeSize = minCodeSize + 1
        codeTable = {}
      }
      else {
        if (nextCode >= (1 << curCodeSize))
          ++curCodeSize
        codeTable[curKey] = nextCode++ // Insert into code table.
      }
      ibCode = k // Index buffer to single input k.
    }
    else {
      ibCode = curCode // Index buffer to sequence in code table.
    }
  }
  emitCode(ibCode) // There will still be something in the index buffer.
  emitCode(eoiCode) // End Of Information.
  emitBytesToBuffer(1)
  if (writer.calculateDistance(curSubblock) === 1) {
    writer.writeByte(0, curSubblock)
  }
  else {
    writer.writeByte(writer.calculateDistance(curSubblock) - 1, curSubblock)
    writer.writeByte(0)
  }
}
