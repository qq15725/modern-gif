import type { EncoderContext } from './encoder-context'

export function writeDataByLzw(minCodeSize: number, data: Uint8Array, context: EncoderContext) {
  const { writeUint8, getCursor, calculateDistance } = context

  writeUint8(minCodeSize)
  let cur_subblock = getCursor()
  writeUint8(0)
  const clear_code = 1 << minCodeSize
  const code_mask = clear_code - 1
  const eoi_code = clear_code + 1
  let next_code = eoi_code + 1
  let cur_code_size = minCodeSize + 1
  let cur_shift = 0
  let cur = 0
  function emit_bytes_to_buffer(bit_block_size: number) {
    while (cur_shift >= bit_block_size) {
      writeUint8(cur & 0xFF)
      cur >>= 8
      cur_shift -= 8
      if (calculateDistance(cur_subblock) === 256) {
        writeUint8(255, cur_subblock)
        cur_subblock = getCursor()
        writeUint8(0)
      }
    }
  }
  function emit_code(c: number) {
    cur |= c << cur_shift
    cur_shift += cur_code_size
    emit_bytes_to_buffer(8)
  }
  let ib_code = data[0] & code_mask // Load first input index.
  let code_table: Record<number, number> = { } // Key'd on our 20-bit "tuple".
  emit_code(clear_code) // Spec says first code should be a clear code.
  for (let i = 1, il = data.length; i < il; ++i) {
    const k = data[i] & code_mask
    const cur_key = ib_code << 8 | k // (prev, k) unique tuple.
    const cur_code = code_table[cur_key] // buffer + k.
    if (cur_code === undefined) {
      cur |= ib_code << cur_shift
      cur_shift += cur_code_size
      while (cur_shift >= 8) {
        writeUint8(cur & 0xFF)
        cur >>= 8
        cur_shift -= 8
        if (calculateDistance(cur_subblock) === 256) {
          writeUint8(255, cur_subblock)
          cur_subblock = getCursor()
          writeUint8(0)
        }
      }
      if (next_code === 4096) {
        // Table full, need a clear.
        emit_code(clear_code)
        next_code = eoi_code + 1
        cur_code_size = minCodeSize + 1
        code_table = {}
      } else {
        if (next_code >= (1 << cur_code_size)) ++cur_code_size
        code_table[cur_key] = next_code++ // Insert into code table.
      }
      ib_code = k // Index buffer to single input k.
    } else {
      ib_code = cur_code // Index buffer to sequence in code table.
    }
  }
  emit_code(ib_code) // There will still be something in the index buffer.
  emit_code(eoi_code) // End Of Information.
  emit_bytes_to_buffer(1)
  if (calculateDistance(cur_subblock) === 1) {
    writeUint8(0, cur_subblock)
  } else {
    writeUint8(calculateDistance(cur_subblock) - 1, cur_subblock)
    writeUint8(0)
  }
}
