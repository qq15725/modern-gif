import { decodeFrames } from './decode-frames'
import { Encoder } from './Encoder'

let encoder: Encoder | undefined

// eslint-disable-next-line no-restricted-globals
self.onmessage = async (event) => {
  const { id, type, data: options } = event.data

  switch (type) {
    case 'encoder:init':
      encoder = new Encoder({ ...options, workerUrl: undefined })
      // eslint-disable-next-line no-restricted-globals
      return self.postMessage({ id, type, data: true })
    case 'encoder:encode':
      // eslint-disable-next-line no-restricted-globals
      return self.postMessage({ id, type, data: await encoder?.encode(options) })
    case 'encoder:flush':
      // eslint-disable-next-line no-restricted-globals
      return self.postMessage({ id, type, data: await encoder?.flush(options) })
    case 'frames:decode': {
      const data = decodeFrames(options)
      // eslint-disable-next-line no-restricted-globals
      return self.postMessage({ id, type, data }, (data as any).map((val: any) => val.data.buffer))
    }
  }
}
