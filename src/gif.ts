// Application Extension
export interface Application {
  identifier: string
  code: string
  data: number[]
}

// Graphic Control Extension
export interface GraphicControl {
  delayTime: number // unit: 10ms
  transparentIndex: number
  // ↓ <Packed Fields>
  reserved: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  disposal: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  userInput: boolean
  transparent: boolean
  // ↑ <Packed Fields>
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
  data: number[]
}

// [R, G, B]
export type RGB = [number, number, number]

// [begin, length]
export type ImageDataPosition = [number, number]

// Image Descriptor
export interface Frame {
  left: number
  top: number
  width: number
  height: number
  // ↓ <Packed Fields>
  localColorTable: boolean
  interlaced: boolean
  reserved: 0 | 1 | 2 | 3
  colorTableSorted: boolean
  colorTableSize: number
  // ↑ <Packed Fields>

  // Local Color Table
  colorTable?: RGB[]

  // LZW Minimum Code Size
  lzwMinCodeSize: number

  // Image Data
  imageDataPositions: ImageDataPosition[]
  // This is only used for `encode`
  imageData?: Uint8ClampedArray

  // Extensions (89a)
  application?: Application
  graphicControl?: GraphicControl
  comment?: Comment
  plainText?: PlainText

  // Custom fields
  index: number
  delay: number // unit: 1ms
  disposal: GraphicControl['disposal']
  colorTableGeneration?: 'MMCQ' | 'NeuQuant'
}

export interface GIF87a {
  // Logical Screen Descriptor
  width: number
  height: number
  // ↓ <Packed Fields>
  globalColorTable: boolean
  colorResoluTion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  colorTableSorted: boolean
  colorTableSize: number
  // ↑ <Packed Fields>
  backgroundColorIndex: number
  pixelAspectRatio: number

  // Global Color Table
  colorTable?: RGB[]

  // Image Descriptor
  frames: Frame[]
}

export interface GIF89a extends GIF87a {
  // Application Extension
  // NETSCAPE2.0
  looped?: boolean
  loopCount?: number
}

export interface GIF extends GIF89a {
  version: '89a' | '87a'

  colorTableGeneration?: 'MMCQ' | 'NeuQuant'
}
