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

## Features

- ⚡️ Encode, Decode

- 🎨 Set max colors(2 - 255)

- 🦄️ Compression size

- ☁️️ Web Worker

- 🦾 TypeScript

## Install

```sh
npm i modern-gif
```

## Usage

```ts
import { encode } from 'modern-gif'
// import the workerUrl through Vite
import workerUrl from 'modern-gif/worker?url'

const output = await encode({
  // workerUrl is optional
  workerUrl,
  width: 200,
  height: 200,
  frames: [
    // CanvasImageSource | BufferSource | string
    { data: '/example1.png', delay: 100 },
    { data: '/example2.png', delay: 100 }
  ],
})

const blob = new Blob([output], { type: 'image/gif' })
window.open(URL.createObjectURL(blob))
```

<details>
<summary>Decode</summary><br>

```ts
import { decode, decodeFrames } from 'modern-gif'
import workerUrl from 'modern-gif/worker?url'

const buffer = await window.fetch('/test.gif')
  .then(res => res.arrayBuffer())

// GIF file format data without image data
const gif = decode(buffer)
console.log(gif)

// Image data for all frames (workerUrl is optional)
const frames = await decodeFrames(buffer, { workerUrl })
frames.forEach((frame) => {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  canvas.getContext('2d').putImageData(
    new ImageData(frame.data, frame.width, frame.height),
    0,
    0,
  )
  document.body.append(canvas)
})
```

<br></details>

<details>
<summary>Compression size</summary><br>

It is easy to compress a gif by encoding and decoding

```ts
import { decode, decodeFrames, encode } from 'modern-gif'
// import the workerUrl through Vite
import workerUrl from 'modern-gif/worker?url'

const buffer = await window.fetch('/test.gif')
  .then(res => res.arrayBuffer())

const gif = decode(buffer)
// workerUrl is optional
const frames = await decodeFrames(buffer, { workerUrl })
const output = await encode({
  // workerUrl is optional
  workerUrl,
  width: gif.width,
  height: gif.height,
  frames,
  // lossy compression 2 - 255
  maxColors: 255,
})

const blob = new Blob([output], { type: 'image/gif' })
window.open(URL.createObjectURL(blob))
```

<br></details>

<details>
<summary>CDN</summary><br>

```html
<script src="https://unpkg.com/modern-gif"></script>
<script>
  modernGif.encode({
    width: 200, height: 200,
    frames: [
      // CanvasImageSource | BufferSource | string
      { data: '/example1.png', delay: 100 },
      { data: '/example2.png', delay: 100 }
    ],
  }).then(output => {
    const blob = new Blob([output], { type: 'image/gif' })
    const link = document.createElement('a')
    link.download = 'screenshot.png'
    link.href = URL.createObjectURL(blob)
    link.click()
  })
</script>
```

<br></details>

## Types

See the [types.ts](src/types.ts)

## Encode Options

See the [options.ts](src/options.ts)

## Specifications

[GIF89a Spec](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)
