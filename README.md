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
  <a href="https://github.com/qq15725/modern-gif/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/modern-gif.svg" alt="License">
  </a>
</p>

## 📦 Install

```sh
npm i modern-gif
```

## 🦄 Usage

### Decode

```ts
import { decode, readFrames } from 'modern-gif'

window.fetch('https://raw.githubusercontent.com/qq15725/modern-gif/master/test/assets/test.gif')
  .then(res => res.arrayBuffer())
  .then(buffer => new Uint8Array(buffer))
  .then(data => {
    const gif = decode(data)

    readFrames(data, gif).forEach(frame => {
      const canvas = document.createElement('canvas')
      const context2d = canvas.getContext('2d')
      canvas.width = frame.width
      canvas.height = frame.height
      context2d.putImageData(frame, 0, 0)
      document.body.append(canvas)
    })

    console.log(gif)
  })
```

### Encode

```ts
import { encode } from 'modern-gif'

const gifData = encode({
  width: 40,
  height: 40,
  frames: [
    {
      imageData: new Uint8ClampedArray(40 * 40 * 4).map(() => 222),
      delay: 100,
    },
    {
      imageData: new Uint8ClampedArray(40 * 40 * 4).map(() => 233),
      delay: 100,
    },
    {
      imageData: new Uint8ClampedArray(40 * 40 * 4).map(() => 244),
      delay: 100,
    },
  ],
})

const blob = new Blob([gifData], { type: 'image/gif' })
window.open(URL.createObjectURL(blob))
```

## Types

See the [gif.ts](src/gif.ts)

## Specifications

[GIF89a Spec](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)
