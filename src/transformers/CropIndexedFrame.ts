import type { EncoderConfig } from '../Encoder'
import type { EncodingFrame } from '../types'

export class CropIndexedFrame implements ReadableWritablePair<EncodingFrame, EncodingFrame> {
  protected _rsControler!: ReadableStreamDefaultController<EncodingFrame>
  protected _frames: Array<any> = []

  readable = new ReadableStream<EncodingFrame>({
    start: controler => this._rsControler = controler,
  })

  writable = new WritableStream<EncodingFrame>({
    write: (frame) => {
      this._frames.push(frame)
    },
    close: () => {
      const transparentIndex = this._config.backgroundColorIndex
      let lastIndexes: ArrayLike<number> | undefined
      this._frames.forEach((frame, index) => {
        const {
          width = 1,
          height = 1,
          data: indexes,
        } = frame

        const transparent = frame.transparent || (this._frames[index + 1]?.transparent ?? true)

        let left = 0
        let top = 0
        let right = width - 1
        let bottom = height - 1

        let prevIndexes: ArrayLike<number> | undefined

        if (transparent) {
          // crop top
          while (top < bottom) {
            let isTrans = true
            for (let x = 0; x < width; x++) {
              if (indexes[width * top + x] !== transparentIndex) {
                isTrans = false
                break
              }
            }
            if (!isTrans)
              break
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
            if (!isTrans)
              break
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
            if (!isTrans)
              break
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
            if (!isTrans)
              break
            right--
          }
        }
        else {
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
              if (!sameLine)
                break
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
              if (!sameLine)
                break
              bottom--
            }

            if (top === bottom) {
              left = right
            }
            else {
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
                if (!sameColumn)
                  break
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
                if (!sameColumn)
                  break
                right--
              }
            }
          }
          prevIndexes = lastIndexes
          lastIndexes = indexes
        }

        const newWidth = right + 1 - left
        const newHeight = bottom + 1 - top
        const croppedIndexes = new Uint8ClampedArray(newWidth * newHeight)
        for (let y = 0; y < newHeight; y++) {
          for (let x = 0; x < newWidth; x++) {
            const index = y * newWidth + x
            const rawIndex = (top + y) * width + (left + x)
            if (!transparent && prevIndexes && indexes[rawIndex] === prevIndexes[rawIndex]) {
              croppedIndexes[index] = transparentIndex
              continue
            }
            croppedIndexes[index] = indexes[rawIndex]
          }
        }

        this._rsControler.enqueue({
          ...frame,
          left,
          top,
          width: newWidth,
          height: newHeight,
          disposal: (transparent ? 2 : 1) as 1 | 2,
          data: croppedIndexes,
          graphicControl: {
            ...frame.graphicControl,
            transparent: true,
            transparentIndex,
          } as any,
        })
      })
      this._rsControler.close()
    },
  })

  constructor(
    protected _config: EncoderConfig,
  ) {
    //
  }
}
