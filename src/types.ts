// Application Extension
export interface Application {
  identifier: string
  authenticationCode: string
  data: string
}

// Graphic Control Extension
export interface GraphicControl {
  delayTime: number
  transparentColorIndex: number
  data: string
  // <Packed Fields>
  reserved: number
  disposalMethod: number
  userInputFlag: boolean
  transparentColorFlag: boolean
}

// Comment Extension
export type Comment = string

// Plain Text Extension
export interface PlainText {
  left: number
  top: number
  width: number
  height: number
  cellWidth: number
  cellHeight: number
  colorIndex: number
  backgroundColorIndex: number
  data: string
}

export interface GIFSpecBlock {
  // Image Descriptor
  left: number
  top: number
  width: number
  height: number
  // <Packed Fields>
  interlaceFlag: boolean
  sortFlag: boolean
  reserved: number

  // Local Color Table
  colors?: number[][]

  // LZW Minimum Code Size
  lzwMinimumCodeSize: number

  // Image Data
  imageData: { begin: number; end: number }[]

  // Extensions
  application?: Application
  graphicControl?: GraphicControl
  comment?: Comment
  plainText?: PlainText
}

export interface GIFSpec {
  // Header
  version: '87a' | '89a'

  // Logical Screen Descriptor
  width: number
  height: number
  backgroundColorIndex: number
  pixelAspectRatio: number
  // <Packed Fields>
  colorResoluTion: number
  sortFlag: boolean

  // Global Color Table
  colors?: number[][]

  // Image Descriptor
  blocks: GIFSpecBlock[]
}

export interface GIF extends GIFSpec {
  read(): Uint8Array[]
}
