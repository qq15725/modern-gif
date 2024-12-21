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

export function mergeBuffers(buffers: Uint8Array[]): Uint8Array {
  const container = new Uint8Array(
    buffers.reduce((total, array) => total + array.byteLength, 0),
  )
  buffers.reduce((offset, array) => {
    container.set(array, offset)
    return offset + array.byteLength
  }, 0)
  return container
}

interface ResovleSourceOptions {
  width?: number
  height?: number
}

export function resovleSource(source: CanvasImageSource | BufferSource, output: 'uint8Array', options?: ResovleSourceOptions): Uint8Array
export function resovleSource(source: CanvasImageSource | BufferSource, output: 'uint8ClampedArray', options?: ResovleSourceOptions): Uint8ClampedArray
export function resovleSource(source: CanvasImageSource | BufferSource, output: 'dataView', options?: ResovleSourceOptions): DataView
export function resovleSource(source: CanvasImageSource | BufferSource, output: 'uint8Array' | 'uint8ClampedArray' | 'dataView', options?: ResovleSourceOptions): any {
  let buffer: ArrayBuffer
  if (ArrayBuffer.isView(source)) {
    buffer = source.buffer as ArrayBuffer
  }
  else if (source instanceof ArrayBuffer) {
    buffer = source
  }
  else {
    const canvas = document.createElement('canvas')
    const { width, height } = options || {}
    const context2d = canvas.getContext('2d')
    if (!context2d) {
      throw new Error('Failed to create canvas context2d')
    }
    canvas.width = width ?? (
      'width' in source
        ? typeof source.width === 'number'
          ? source.width
          : source.width.baseVal.value
        : 0
    )
    canvas.height = height ?? (
      'height' in source
        ? typeof source.height === 'number'
          ? source.height
          : source.height.baseVal.value
        : 0
    )
    context2d.drawImage(source, 0, 0, canvas.width, canvas.height)
    buffer = context2d.getImageData(0, 0, canvas.width, canvas.height).data.buffer as ArrayBuffer
  }

  switch (output) {
    case 'uint8Array':
      return new Uint8Array(buffer)
    case 'uint8ClampedArray':
      return new Uint8ClampedArray(buffer)
    case 'dataView':
      return new DataView(buffer)
    default:
      throw new Error('Unsupported output format')
  }
}

export function createImage(url: string): HTMLImageElement {
  const img = new Image()
  img.decoding = 'sync'
  img.loading = 'eager'
  img.crossOrigin = 'anonymous'
  img.src = url
  return img
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = createImage(url)
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}
