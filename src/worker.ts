import { encodeFrame } from './encode-frame'

self.onmessage = event => {
  const { index, frame } = event.data

  const data = encodeFrame(frame)

  self.postMessage({ index, data }, [data.buffer])
}
