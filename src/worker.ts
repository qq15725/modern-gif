import { createPalette } from 'modern-palette'
import { decodeFrames } from './decode-frames'
import { encodeFrame } from './encode-frame'
import { indexFrames } from './index-frames'
import { cropFrames } from './crop-frames'
import type { Palette } from 'modern-palette'

let palette: Palette | null = null

self.onmessage = event => {
  const { id, data: requestData } = event.data
  const { type } = requestData

  if (type === 'palette:init') {
    const { options } = requestData
    palette = createPalette(options)
    return self.postMessage({ id, data: true })
  }

  if (type === 'palette:addSample' && palette) {
    const { options } = requestData
    palette.addSample(options)
    return self.postMessage({ id, data: true })
  }

  if (type === 'palette:generate' && palette) {
    const { options } = requestData
    palette.generate(options)
    const data = { ...palette.context }
    palette.reset()
    return self.postMessage({ id, data })
  }

  if (type === 'frames:index') {
    const { options } = requestData
    const data = indexFrames(options)
    return self.postMessage({ id, data }, data.map(val => val.imageData.buffer))
  }

  if (type === 'frames:crop') {
    const { options } = requestData
    const data = cropFrames(options)
    return self.postMessage({ id, data }, data.map(val => val.imageData.buffer))
  }

  if (type === 'frame:encode') {
    const { options } = requestData
    const data = encodeFrame(options)
    return self.postMessage({ id, data }, [data.buffer])
  }

  if (type === 'frames:decode') {
    const { source } = requestData
    const data = decodeFrames(source)
    return self.postMessage({ id, data }, data.map(val => val.imageData.buffer))
  }
}
