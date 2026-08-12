import type { Buffer } from 'node:buffer'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { decode } from '../src/decode'
import { Reader } from '../src/Reader'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe('reader.readSubBlock', () => {
  it('reads a single length-prefixed chunk without truncating on an embedded 0x00 byte', () => {
    // length=5, data="A\0BCD" (embeds a 0x00 mid-payload), terminator=0x00.
    // A real GIF sub-block's data is arbitrary bytes, so 0x00 can legally
    // appear inside it — only a 0x00 *length* byte terminates the sequence.
    const bytes = new Uint8Array([5, 0x41, 0x00, 0x42, 0x43, 0x44, 0])
    const reader = new Reader(bytes)

    expect(reader.readSubBlock()).toEqual([0x41, 0x00, 0x42, 0x43, 0x44])
    // Fully consumed: 1 length byte + 5 data bytes + 1 terminator byte.
    expect(reader.offset).toBe(7)
  })

  it('reads multiple chunks in one sub-block sequence', () => {
    // Two chunks (length=3, length=2) followed by the terminator.
    const bytes = new Uint8Array([3, 1, 2, 3, 2, 4, 5, 0])
    const reader = new Reader(bytes)

    expect(reader.readSubBlock()).toEqual([1, 2, 3, 4, 5])
    expect(reader.offset).toBe(8)
  })
})

describe('decode', () => {
  const assetsDir = resolve(__dirname, 'assets')

  it.each(readdirSync(assetsDir))('parses %s without hitting an unknown block', (name) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bytes = readFileSync(resolve(assetsDir, name))

    const gif = decode(toArrayBuffer(bytes))

    expect(gif.frames.length).toBeGreaterThan(0)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
