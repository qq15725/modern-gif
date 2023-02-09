// Application Extension
export interface Application {
  identifier: string
  code: string
  data: string
}

// Graphic Control Extension
export interface GraphicControl {
  // Unit: 1/100
  delayTime: number
  transparentIndex: number
  // <Packed Fields>
  reserved: number
  disposal: 1 | 2 | 3 | 4 | 5 | 6 | 7
  userInput: boolean
  transparent: boolean
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

export type RGB = number[]

// Image Descriptor
export interface Frame {
  left: number
  top: number
  width: number
  height: number
  // <Packed Fields>
  localColorTable: boolean
  colorTableSize: number
  interlaced: boolean
  colorSorted: boolean
  reserved: number
  paletteIsSorted?: boolean

  // Local Color Table
  colors?: RGB[]

  // LZW Minimum Code Size
  minCodeSize: number

  // Image Data
  image: { begin: number; end: number }[]

  // Unit: ms
  delay: number

  // Extensions
  application?: Application
  graphicControl?: GraphicControl
  comment?: Comment
  plainText?: PlainText
}

export interface GIF {
  // Header
  version: '87a' | '89a'

  // Logical Screen Descriptor
  width: number
  height: number
  backgroundColorIndex: number
  pixelAspectRatio: number
  // <Packed Fields>
  globalColorTable: boolean
  colorResoluTion: number
  colorTableSize: number
  colorSorted?: boolean

  // Global Color Table
  colors?: RGB[]

  // Application Extension
  // NETSCAPE2.0
  loop: number

  // Image Descriptor
  frames: Frame[]

  readFrame(index: number): ImageData
}
