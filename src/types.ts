export interface GIFSpecBlock {
  // Image Descriptor
  imageLeftPosition: number
  imageRightPosition: number
  imageWidth: number
  imageHeight: number
  // <Packed Fields>
  localColorTableFlag: boolean
  interlaceFlag: boolean
  sortFlag: boolean
  reserved: number
  sizeOfLocalColorTable: number

  // Local Color Table
  localColorTable: number[][]

  // LZW Minimum Code Size
  lzwMinimumCodeSize: number

  // Image Data
  imageData: {
    begin: number
    end: number
  }[]
}

export interface GIFSpec {
  // Header
  signature: 'GIF'
  version: '87a' | '89a'

  // Logical Screen Descriptor
  width: number
  height: number
  backgroundColorIndex: number
  pixelAspectRatio: number
  // <Packed Fields>
  globalColorTableFlag: boolean
  colorResoluTion: number
  sortFlag: boolean
  sizeOfGlobalColorTable: number

  // Global Color Table
  globalColorTable: number[][]

  // Graphic Control Extension
  blockSize: number
  delayTime: number
  transparentColorIndex: number
  // <Packed Fields>
  reserved: number
  disposalMethod: number
  userInputFlag: boolean
  transparentColorFlag: boolean

  // Comment Extension
  commentData: string

  // Image Descriptor
  blocks: GIFSpecBlock[]
}

export interface GIF extends GIFSpec {
  read(): Uint8Array[]
}
