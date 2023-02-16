import type { RGB } from './gif'

export type ColorDimension = 'r' | 'g' | 'b'

class Color {
  r: number
  g: number
  b: number

  static compose(color: Color, bit: number): number {
    const r = color.r >> (8 - bit)
    const g = color.g >> (8 - bit)
    const b = color.b >> (8 - bit)

    return (r << (2 * bit)) + (g << bit) + b
  }

  static delta(c1: Color, c2: Color): number {
    return (
      Math.abs(c1.r - c2.r) ** 2
      + Math.abs(c1.g - c2.g) ** 2
      + Math.abs(c1.b - c2.b) ** 2
    )
  }

  static formHex(hex: number) {
    const c = hexToRgb(hex.toString(16).padStart(6, '0'))

    return new Color(c.r, c.g, c.b)
  }

  constructor(r = 0, g = 0, b = 0) {
    this.r = r
    this.g = g
    this.b = b
  }

  toString(): string {
    return this.r.toString(16) + this.g.toString(16) + this.b.toString(16)
  }

  compose(bit: number): number {
    return Color.compose(this, bit)
  }
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

  return {
    r: parseInt(result?.[1] || '0', 16),
    g: parseInt(result?.[2] || '0', 16),
    b: parseInt(result?.[3] || '0', 16),
  }
}

interface PixelCount {
  num: number
  color: Color
}

class ColorVolume {
  #pixels: Map<number, PixelCount> = new Map()
  #size = 0
  #bit: number

  constructor(bit: number, pixels?: Map<number, PixelCount>, count = 0) {
    this.#bit = bit

    if (!pixels) return

    this.#pixels = pixels
    this.#size = count
  }

  static fromColors(colors: Color[], bit: number): ColorVolume {
    if (!colors) return new ColorVolume(bit)

    const pixels: Map<number, PixelCount> = new Map()

    colors.forEach((color) => {
      const index = color.compose(bit)

      if (pixels.has(index)) {
        const pixel = pixels.get(index)!
        pixel.num += 1
      } else {
        pixels.set(index, {
          num: 1,
          color,
        })
      }
    })

    return new ColorVolume(bit, pixels, colors.length)
  }

  get size() {
    return this.#size
  }

  mainColor(): Color {
    const avg = { r: 0, g: 0, b: 0 }

    for (const pixel of this.#pixels.values()) {
      avg.r += pixel.num * pixel.color.r
      avg.g += pixel.num * pixel.color.g
      avg.b += pixel.num * pixel.color.b
    }

    avg.r = avg.r / this.size
    avg.g = avg.g / this.size
    avg.b = avg.b / this.size

    return new Color(avg.r, avg.g, avg.b)
  }

  private deltaDimension() {
    let dimension: ColorDimension = 'b'
    const max: Color = new Color(0, 0, 0)
    const min: Color = new Color(255, 255, 255)

    const dimensions = ['r', 'g', 'b'] as const

    for (const pixel of this.#pixels.values()) {
      dimensions.forEach((d) => {
        max[d] = Math.max(max[d], pixel.color[d])
        min[d] = Math.min(min[d], pixel.color[d])
      })
    }

    const delta: Color = new Color()
    delta.r = max.r - min.r
    delta.g = max.g - min.g
    delta.b = max.b - min.b

    dimension
      = delta.r >= delta.g && delta.r >= delta.b
        ? 'r'
        : delta.g >= delta.r && delta.g >= delta.b
          ? 'g'
          : 'b'

    return {
      dimension,
      middle: (max[dimension] + min[dimension]) / 2,
    }
  }

  cutWithDimension() {
    interface IPixelCount {
      size: number
      pixels: Map<number, PixelCount>
    }

    const { dimension, middle } = this.deltaDimension()

    const left: IPixelCount = { size: 0, pixels: new Map() }
    const right: IPixelCount = { size: 0, pixels: new Map() }

    for (const pixel of this.#pixels.values()) {
      const idx = pixel.color.compose(this.#bit)

      const next = pixel.color[dimension] > middle ? right : left

      next.size += pixel.num

      if (next.pixels.has(idx)) {
        const x = next.pixels.get(idx)!
        x.num += pixel.num
      } else {
        next.pixels.set(idx, pixel)
      }
    }

    return {
      right: new ColorVolume(this.#bit, right.pixels, right.size),
      left: new ColorVolume(this.#bit, left.pixels, left.size),
    }
  }
}

class MMCQ {
  private volumes: ColorVolume[] = []
  private pixels: Color[] = []
  #bit: number

  constructor(data: Uint8ClampedArray, bit = 8) {
    this.#bit = bit

    for (let i = 0; i < data.length; i += 4) {
      const color = new Color(data[i], data[i + 1], data[i + 2])
      this.pixels.push(color)
    }

    this.volumes = [ColorVolume.fromColors(this.pixels, this.#bit)]
  }

  getPalette(length: number): RGB[] {
    while (this.volumes.length < length) {
      const newVolumes: ColorVolume[] = []

      for (let i = 0, max = this.volumes.length; i < max; i++) {
        const volume = this.volumes[i]
        const { left, right } = volume.cutWithDimension()

        if (left.size !== 0) newVolumes.push(left)
        if (right.size !== 0) newVolumes.push(right)
      }

      if (newVolumes.length === this.volumes.length) {
        break
      }

      this.volumes = newVolumes.sort((a, b) => b.size - a.size)
    }

    const avgColors = this.volumes.slice(0, length).map((v) => v.mainColor())

    return this.getSimilarPalette(avgColors)
  }

  getSimilarPalette(avgColors: Color[]): RGB[] {
    const colorNumber = avgColors.length

    interface IMainColor {
      delta: number
      color: Color
    }

    const colors: IMainColor[] = new Array(colorNumber)

    for (let i = 0; i < colorNumber; i++) {
      colors[i] = {
        delta: 255 ** 2 * 3,
        color: new Color(),
      }
    }

    this.pixels.forEach((pixel) => {
      for (let i = 0; i < colorNumber; i++) {
        const mainColor = colors[i]
        const delta = Color.delta(pixel, avgColors[i])

        if (delta < mainColor.delta) {
          mainColor.delta = delta
          mainColor.color = pixel
        }
      }
    })

    return colors.map((c) => [c.color.r, c.color.g, c.color.b])
  }
}

export function getPaletteByMmcq(data: Uint8ClampedArray, length: number) {
  return new MMCQ(data).getPalette(length)
}
