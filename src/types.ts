// Application Extension
export interface Application {
  identifier: string
  authenticationCode: string
  data: string
}

// Graphic Control Extension
export interface GraphicControl {
  // Unit: 1/100
  delay: number
  transparentIndex?: number
  // <Packed Fields>
  reserved: number
  disposalMethod: number
  userInput: boolean
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
  interlaced: boolean
  reserved: number
  paletteIsSorted?: boolean

  // Local Color Table
  palette?: RGB[]

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
  backgroundColor?: RGB
  pixelAspectRatio: number
  // <Packed Fields>
  colorResoluTion: number
  paletteIsSorted?: boolean

  // Global Color Table
  palette?: RGB[]

  // Image Descriptor
  frames: Frame[]

  readFrame(index: number): ImageData
}
