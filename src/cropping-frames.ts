import type { EncodeFrameOptions } from './options'

export function croppingFrames(
  frames: EncodeFrameOptions[],
  allIndexes: Uint8Array[],
  transparents: boolean[],
  transparentIndex: number,
) {
  let lastIndexes: Uint8Array | undefined
  const framesLength = frames.length
  const boxes = frames.map((frame, index) => {
    const { width = 1, height = 1 } = frame
    const indexes = allIndexes[index]
    const isTranslucent = transparents[index]
    let left = 0
    let top = 0
    let right = width - 1
    let bottom = height - 1

    let prevIndexes: Uint8Array | undefined
    if (isTranslucent) {
      // crop top
      while (top < bottom) {
        let isTrans = true
        for (let x = 0; x < width; x++) {
          if (indexes[width * top + x] !== transparentIndex) {
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
          if (indexes[width * bottom + x] !== transparentIndex) {
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
          if (indexes[width * y + left] !== transparentIndex) {
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
          if (indexes[width * y + right] !== transparentIndex) {
            isTrans = false
            break
          }
        }
        if (!isTrans) break
        right--
      }
    } else {
      if (lastIndexes) {
        // skip common lines
        while (top < bottom) {
          let sameLine = true
          for (let x = 0; x < width; x++) {
            const index = width * top + x
            if (indexes[index] !== lastIndexes[index]) {
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
            if (indexes[index] !== lastIndexes[index]) {
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
              if (indexes[index] !== lastIndexes[index]) {
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
              if (indexes[index] !== lastIndexes[index]) {
                sameColumn = false
                break
              }
            }
            if (!sameColumn) break
            right--
          }
        }
      }
      prevIndexes = lastIndexes
      lastIndexes = indexes
    }

    return {
      left,
      right,
      top,
      bottom,
      isTranslucent,
      prevIndexes,
      disposal: (isTranslucent && index !== framesLength - 1 ? 2 : 1) as 2 | 1,
      width: right + 1 - left,
      height: bottom + 1 - top,
    }
  })

  return {
    boxes,
    allIndexes: frames.map((frame, index) => {
      const { width: rawWidth = 1 } = frame
      const indexes = allIndexes[index]
      const { top, left, width, height, isTranslucent, prevIndexes } = boxes[index]
      const croppedIndexes = new Uint8Array(width * height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x
          const rawIndex = (top + y) * rawWidth + (left + x)
          if (!isTranslucent && prevIndexes && indexes[rawIndex] === prevIndexes[rawIndex]) {
            croppedIndexes[index] = transparentIndex
            continue
          }
          croppedIndexes[index] = indexes[rawIndex]
        }
      }
      return croppedIndexes
    }),
  }
}
