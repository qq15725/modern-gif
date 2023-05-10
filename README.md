<h1 align="center">modern-gif</h1>

<p align="center">
  <a href="https://unpkg.com/modern-gif">
    <img src="https://img.shields.io/bundlephobia/minzip/modern-gif" alt="Minzip">
  </a>
  <a href="https://www.npmjs.com/package/modern-gif">
    <img src="https://img.shields.io/npm/v/modern-gif.svg" alt="Version">
  </a>
  <a href="https://www.npmjs.com/package/modern-gif">
    <img src="https://img.shields.io/npm/dm/modern-gif" alt="Downloads">
  </a>
  <a href="https://github.com/qq15725/modern-gif/issues">
    <img src="https://img.shields.io/github/issues/qq15725/modern-gif" alt="Issues">
  </a>
  <a href="https://github.com/qq15725/modern-gif/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/modern-gif.svg" alt="License">
  </a>
</p>

## 📦 Install

```sh
npm i modern-gif
```

## 🦄 Usage

### Encode

```ts
import { encode } from 'modern-gif'
// import the `workerUrl` through `Vite`
import workerUrl from 'modern-gif/worker?url'

const output = await encode({
  workerUrl,
  workerNumber: 2,
  width: 200,
  height: 200,
  frames: [
    {
      // supports CanvasImageSource | BufferSource | string
      imageData: '/example1.png',
      delay: 100,
    },
    {
      imageData: '/example2.png',
      delay: 100,
    }
  ]
})

const blob = new Blob([output], { type: 'image/gif' })
window.open(URL.createObjectURL(blob))
```

### Decode

```ts
import { decode, decodeFramesInWorker } from 'modern-gif'
// import the `workerUrl` through `Vite`
import workerUrl from 'modern-gif/worker?url'

const buffer = await window.fetch('/test.gif').then(res => res.arrayBuffer())

const gif = decode(buffer)
console.log(gif)

decodeFramesInWorker(buffer, workerUrl).forEach(frame => {
  const canvas = document.createElement('canvas')
  const context2d = canvas.getContext('2d')
  canvas.width = frame.width
  canvas.height = frame.height
  context2d.putImageData(
    new ImageData(frame.imageData, frame.width, frame.height),
    0, 0,
  )
  document.body.append(canvas)
})
```

## Types

See the [gif.ts](src/gif.ts)

## Encode Options

See the [options.ts](src/options.ts)

## Specifications

[GIF89a Spec](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)
