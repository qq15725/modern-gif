import { createPalette } from 'modern-palette'
import { decodeFrames } from './decode-frames'
import { encodeFrame } from './encode-frame'
import { indexFrames } from './index-frames'
import { cropFrames } from './crop-frames'
import type { Palette } from 'modern-palette'

let palette: Palette | null = null

self.onmessage = event => {
  const { data: eventData } = event
  const { type, uuid } = eventData

  if (type === 'palette:init') {
    const { options } = eventData
    palette = createPalette(options)
    return self.postMessage({ uuid, data: true })
  }

  if (type === 'palette:addSample' && palette) {
    const { options } = eventData
    palette.addSample(options)
    return self.postMessage({ uuid, data: true })
  }

  if (type === 'palette:generate' && palette) {
    const { options } = eventData
    palette.generate(options)
    const data = { ...palette.context }
    palette.reset()
    return self.postMessage({ uuid, data })
  }

  if (type === 'frames:index') {
    const { options } = eventData
    const data = indexFrames(options)
    return self.postMessage({ uuid, data }, data.map(val => val.imageData.buffer))
  }

  if (type === 'frames:crop') {
    const { options } = eventData
    const data = cropFrames(options)
    return self.postMessage({ uuid, data }, data.map(val => val.imageData.buffer))
  }

  if (type === 'frame:encode') {
    const { options } = eventData
    const data = encodeFrame(options)
    return self.postMessage({ uuid, data }, [data.buffer])
  }

  if (type === 'frames:decode') {
    const { source } = eventData
    const data = decodeFrames(source)
    return self.postMessage({ uuid, data }, data.map(val => val.imageData.buffer))
  }
}
