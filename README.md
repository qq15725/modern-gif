<h1 align="center">modern-gif</h1>

<p align="center">
  <a href="https://unpkg.com/modern-gif">
    <img src="https://img.shields.io/bundlephobia/minzip/modern-gif" alt="Minzip">
  </a>
  <a href="https://www.npmjs.com/package/modern-gif">
    <img src="https://img.shields.io/npm/v/modern-gif.svg" alt="Version">
  </a>
  <a href="https://www.npmjs.com/package/modern-gif">
    <img src="https://img.shields.io/npm/dw/modern-gif" alt="Downloads">
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
import GIF from 'modern-gif'

window.fetch('https://raw.githubusercontent.com/qq15725/modern-gif/master/test/assets/test.gif')
  .then(res => res.arrayBuffer())
  .then(buffer => new Uint8Array(buffer))
  .then(dataView => {
    const gif = GIF.decode(dataView)
    const frame = gif.readFrame(0)
    console.log(gif)

    const canvas = document.createElement('canvas')
    const context2d = canvas.getContext('2d')
    canvas.width = frame.width
    canvas.height = frame.height
    context2d.putImageData(frame, 0, 0)
    document.body.append(canvas)
  })
```

## Types

See the [types.ts](src/types.ts)

## Specifications

[GIF89a Spec](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)
