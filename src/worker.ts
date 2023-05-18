import { createPalette } from 'modern-palette'
import { decodeFrames } from './decode-frames'
import { encodeFrame } from './encode-frame'
import { indexFrames } from './index-frames'
import { cropFrames } from './crop-frames'

const palette = createPalette({
  skipTransparent: false,
})

self.onmessage = event => {
  const { id, type, data: req } = event.data

  if (type === 'palette:addSample' && palette) {
    palette.addSample(req)
    return self.postMessage({ id, type, data: true })
  }

  if (type === 'palette:generate' && palette) {
    palette.generate(req)
    const data = { ...palette.context }
    palette.reset()
    return self.postMessage({ id, type, data })
  }

  if (type === 'frames:index') {
    const data = indexFrames(req)
    return self.postMessage({ id, type, data }, data.map(val => val.imageData.buffer))
  }

  if (type === 'frames:crop') {
    const data = cropFrames(req)
    return self.postMessage({ id, type, data }, data.map(val => val.imageData.buffer))
  }

  if (type === 'frame:encode') {
    const data = encodeFrame(req)
    return self.postMessage({ id, type, data }, [data.buffer])
  }

  if (type === 'frames:decode') {
    const data = decodeFrames(req)
    return self.postMessage({ id, type, data }, data.map(val => val.imageData.buffer))
  }
}
