import { cropBuffer } from './utils'

export interface CropFramesOptions {
  frames: {
    width: number
    height: number
    imageData: Uint8ClampedArray
    transparent: boolean
  }[]
  transparentIndex: number
}

export function cropFrames(options: CropFramesOptions) {
  const { frames, transparentIndex } = options

  let lastIndexPixels: Uint8ClampedArray | undefined

  const framesLength = frames.length
  return frames.map((frame, index) => {
    const {
      width,
      height,
      transparent,
      imageData: indexPixels,
    } = frame

    let left = 0
    let top = 0
    let right = width - 1
    let bottom = height - 1

    let prevIndexPixels: Uint8ClampedArray | undefined

    if (transparent) {
      // crop top
      while (top < bottom) {
        let isTrans = true
        for (let x = 0; x < width; x++) {
          if (indexPixels[width * top + x] !== transparentIndex) {
            isTrans = false
            break
          }
        }
        if (!isTrans) break
        top++
      }

      // crop bottom
      while (bottom > top) {
        let isTrans = true
        for (let x = 0; x < width; x++) {
          if (indexPixels[width * bottom + x] !== transparentIndex) {
            isTrans = false
            break
          }
        }
        if (!isTrans) break
        bottom--
      }

      // crop left
      while (left < right) {
        let isTrans = true
        for (let y = top; y < bottom; y++) {
          if (indexPixels[width * y + left] !== transparentIndex) {
            isTrans = false
            break
          }
        }
        if (!isTrans) break
        left++
      }

      // crop right
      while (right > left) {
        let isTrans = true
        for (let y = top; y < bottom; y++) {
          if (indexPixels[width * y + right] !== transparentIndex) {
            isTrans = false
            break
          }
        }
        if (!isTrans) break
        right--
      }
    } else {
      if (lastIndexPixels) {
        // skip common lines
        while (top < bottom) {
          let sameLine = true
          for (let x = 0; x < width; x++) {
            const index = width * top + x
            if (indexPixels[index] !== lastIndexPixels[index]) {
              sameLine = false
              break
            }
          }
          if (!sameLine) break
          top++
        }
        while (bottom > top) {
          let sameLine = true
          for (let x = 0; x < width; x++) {
            const index = width * bottom + x
            if (indexPixels[index] !== lastIndexPixels[index]) {
              sameLine = false
              break
            }
          }
          if (!sameLine) break
          bottom--
        }

        if (top === bottom) {
          left = right
        } else {
          // skip common columns
          while (left < right) {
            let sameColumn = true
            for (let y = top; y <= bottom; y++) {
              const index = y * width + left
              if (indexPixels[index] !== lastIndexPixels[index]) {
                sameColumn = false
                break
              }
            }
            if (!sameColumn) break
            left++
          }
          while (right > left) {
            let sameColumn = true
            for (let y = top; y <= bottom; y++) {
              const index = y * width + right
              if (indexPixels[index] !== lastIndexPixels[index]) {
                sameColumn = false
                break
              }
            }
            if (!sameColumn) break
            right--
          }
        }
      }
      prevIndexPixels = lastIndexPixels
      lastIndexPixels = indexPixels
    }

    const newWidth = right + 1 - left
    const newHeight = bottom + 1 - top

    const croppedIndexPixels = cropBuffer(
      indexPixels,
      {
        left,
        top,
        width: newWidth,
        height: newHeight,
        rawWidth: width,
        rate: 1,
        callback: rawIndex => {
          if (!transparent && prevIndexPixels && indexPixels[rawIndex] === prevIndexPixels[rawIndex]) {
            return transparentIndex
          }
          return undefined
        },
      },
    )

    return {
      left,
      top,
      width: newWidth,
      height: newHeight,
      disposal: (transparent && index !== framesLength - 1 ? 2 : 1) as 2 | 1,
      imageData: croppedIndexPixels,
    }
  })
}
