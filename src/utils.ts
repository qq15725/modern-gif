// Constants
export const PREFIX = '[modern-gif]'

// GIF
export const SIGNATURE = 'GIF'
export const VERSIONS = ['87a', '89a']
export const IMAGE_DESCRIPTOR = 0x2C
export const EXTENSION = 0x21
export const EXTENSION_APPLICATION = 0xFF
export const EXTENSION_APPLICATION_BLOCK_SIZE = 11
export const EXTENSION_COMMENT = 0xFE
export const EXTENSION_GRAPHIC_CONTROL = 0xF9
export const EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE = 4
export const EXTENSION_PLAIN_TEXT = 0x01
export const EXTENSION_PLAIN_TEXT_BLOCK_SIZE = 0x01
export const TRAILER = 0x3B

// Console
export const consoleWarn = (...args: any[]) => console.warn(PREFIX, ...args)
// eslint-disable-next-line no-console
export const consoleTime = (label: string) => console.time(`${ PREFIX } ${ label }`)
// eslint-disable-next-line no-console
export const consoleTimeEnd = (label: string) => console.timeEnd(`${ PREFIX } ${ label }`)

export function mergeUint8Array(...arrays: Uint8Array[]): Uint8Array {
  const container = new Uint8Array(
    arrays.reduce((total, array) => total + array.byteLength, 0),
  )
  arrays.reduce((offset, array) => {
    container.set(array, offset)
    return offset + array.byteLength
  }, 0)
  return container
}

export function resovleUint8Array(source: BufferSource): Uint8Array {
  if (source instanceof Uint8Array) {
    return source
  } else if (source instanceof ArrayBuffer) {
    return new Uint8Array(source)
  } else {
    return new Uint8Array(source.buffer)
  }
}

export function resovleDataView(source: BufferSource): DataView {
  if (source instanceof DataView) {
    return source
  } else if (source instanceof ArrayBuffer) {
    return new DataView(source)
  } else {
    return new DataView(source.buffer)
  }
}
