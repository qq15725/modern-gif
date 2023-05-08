export function lzwDecode(minCodeSize: number, data: Uint8Array, pixelCount: number) {
  const MAX_STACK_SIZE = 4096
  const nullCode = -1
  const npix = pixelCount
  let available, codeMask, codeSize, inCode, oldCode, code, i

  const dstPixels = new Array(pixelCount)
  const prefix = new Array(MAX_STACK_SIZE)
  const suffix = new Array(MAX_STACK_SIZE)
  const pixelStack = new Array(MAX_STACK_SIZE + 1)

  // Initialize GIF data stream decoder.
  const dataSize = minCodeSize
  const clear = 1 << dataSize
  const endOfInformation = clear + 1
  available = clear + 2
  oldCode = nullCode
  codeSize = dataSize + 1
  codeMask = (1 << codeSize) - 1
  for (code = 0; code < clear; code++) {
    prefix[code] = 0
    suffix[code] = code
  }

  // Decode GIF pixel stream.
  let datum, bits, first, top, pi, bi
  datum = bits = first = top = pi = bi = 0
  for (i = 0; i < npix;) {
    if (top === 0) {
      if (bits < codeSize) {
        // get the next byte
        datum += data[bi] << bits

        bits += 8
        bi++
        continue
      }
      // Get the next code.
      code = datum & codeMask
      datum >>= codeSize
      bits -= codeSize
      // Interpret the code
      if (code > available || code === endOfInformation) {
        break
      }
      if (code === clear) {
        // Reset decoder.
        codeSize = dataSize + 1
        codeMask = (1 << codeSize) - 1
        available = clear + 2
        oldCode = nullCode
        continue
      }
      if (oldCode === nullCode) {
        pixelStack[top++] = suffix[code]
        oldCode = code
        first = code
        continue
      }
      inCode = code
      if (code === available) {
        pixelStack[top++] = first
        code = oldCode
      }
      while (code > clear) {
        pixelStack[top++] = suffix[code]
        code = prefix[code]
      }

      first = suffix[code] & 0xFF
      pixelStack[top++] = first

      // add a new string to the table, but only if space is available
      // if not, just continue with current table until a clear code is found
      // (deferred clear code implementation as per GIF spec)
      if (available < MAX_STACK_SIZE) {
        prefix[available] = oldCode
        suffix[available] = first
        available++
        if ((available & codeMask) === 0 && available < MAX_STACK_SIZE) {
          codeSize++
          codeMask += available
        }
      }
      oldCode = inCode
    }
    // Pop a pixel off the pixel stack.
    top--
    dstPixels[pi++] = pixelStack[top]
    i++
  }

  for (i = pi; i < npix; i++) {
    dstPixels[i] = 0 // clear missing pixels
  }

  return dstPixels
}
