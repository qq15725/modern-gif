// Constants
export const PREFIX = '[modern-gif]'
export const IN_BROWSER = typeof window !== 'undefined'
export const SUPPORT_IMAGE_DECODER = IN_BROWSER && 'ImageDecoder' in window

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
