import { decodeFrames } from './decode-frames'
import { encodeFrame } from './encode-frame'

self.onmessage = event => {
  const { data: eventData } = event
  const { type = 'encode-frames', uuid } = eventData

  if (type === 'encode-frame') {
    const { frame, indexes } = eventData
    const data = encodeFrame(frame, indexes)
    return self.postMessage({ uuid, data }, [data.buffer])
  }

  if (type === 'decode-frames') {
    const { gif } = eventData
    const frames = decodeFrames(gif)
    return self.postMessage({ uuid, frames }, frames.map(frame => frame.data.buffer))
  }
}
