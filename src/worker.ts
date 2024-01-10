import { decodeFrames } from './decode-frames'
import { Encoder } from './Encoder'

let encoder: Encoder | undefined

self.onmessage = async event => {
  const { id, type, data: options } = event.data

  switch (type) {
    case 'encoder:init':
      encoder = new Encoder({ ...options, workerUrl: undefined })
      return self.postMessage({ id, type, data: true })
    case 'encoder:encode':
      return self.postMessage({ id, type, data: await encoder?.encode(options) })
    case 'encoder:flush':
      return self.postMessage({ id, type, data: await encoder?.flush(options) })
    case 'frames:decode': {
      const data = decodeFrames(options)
      return self.postMessage({ id, type, data }, data.map(val => val.data.buffer))
    }
  }
}
