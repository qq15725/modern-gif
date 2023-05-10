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

export function resovleSourceBox(source: CanvasImageSource | BufferSource) {
  if (ArrayBuffer.isView(source) || source instanceof ArrayBuffer) {
    return undefined
  } else {
    return {
      width: typeof source.width === 'number' ? source.width : source.width.baseVal.value,
      height: typeof source.height === 'number' ? source.height : source.height.baseVal.value,
    }
  }
}

export function resovleSource(source: CanvasImageSource | BufferSource, output: 'uint8Array'): Uint8Array
export function resovleSource(source: CanvasImageSource | BufferSource, output: 'uint8ClampedArray'): Uint8ClampedArray
export function resovleSource(source: CanvasImageSource | BufferSource, output: 'dataView'): DataView
export function resovleSource(source: CanvasImageSource | BufferSource, output: 'uint8Array' | 'uint8ClampedArray' | 'dataView') {
  let buffer: ArrayBuffer
  if (ArrayBuffer.isView(source)) {
    buffer = source.buffer
  } else if (source instanceof ArrayBuffer) {
    buffer = source
  } else {
    const canvas = document.createElement('canvas')
    const { width, height } = resovleSourceBox(source)!
    canvas.width = width
    canvas.height = height
    const context2d = canvas.getContext('2d')
    if (!context2d) {
      throw new Error('Failed to create canvas context2d')
    }
    context2d.drawImage(source, 0, 0)
    buffer = context2d.getImageData(0, 0, canvas.width, canvas.height).data.buffer
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

export function cropBuffer(
  buffer: Uint8ClampedArray,
  options: {
    top?: number
    left?: number
    width: number
    height: number
    rawWidth: number
    rate?: number
    callback?: (rawIndex: number) => number | undefined
  },
) {
  const { top = 0, left = 0, width, height, rawWidth, rate = 4, callback } = options

  const croppedBuffer = new Uint8ClampedArray(width * height * rate)

  const startX = left * rate
  const startY = top * rate
  const lineSize = width * rate
  const rawLineSize = rawWidth * rate

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < lineSize; x++) {
      const index = (startY + y) * rawLineSize + (startX + x)
      croppedBuffer[y * lineSize + x] = callback?.(index) ?? buffer[index]
    }
  }

  return croppedBuffer
}
