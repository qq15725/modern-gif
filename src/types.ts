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

// [R, G, B]
export type RGB = [number, number, number]

// [begin, length]
export type ImageSubBlockRange = [number, number]

// Image Descriptor
export interface Frame {
  left: number
  top: number
  width: number
  height: number
  // <Packed Fields>
  localColorTable: boolean
  interlaced: boolean
  colorSorted: boolean
  reserved: number
  colorTableSize: number

  // Local Color Table
  colors?: RGB[]

  // LZW Minimum Code Size
  minCodeSize: number

  // Image Data
  imageData: ImageSubBlockRange[]

  // Unit: ms
  delay: number

  // 89a
  // Extensions
  application?: Application
  graphicControl?: GraphicControl
  comment?: Comment
  plainText?: PlainText
}

export interface GIF87a {
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

  // Image Descriptor
  frames: Frame[]
}

export interface GIF89a extends GIF87a {
  // Application Extension
  // NETSCAPE2.0
  loop: number
}

export interface GIF extends GIF89a {
  version: '89a' | '87a'
}
