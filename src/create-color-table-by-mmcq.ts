import type { RGB } from './gif'

type VBox = ReturnType<typeof createVBox>
type PQueue = ReturnType<typeof createPQueue>

const sigbits = 5
const rshift = 8 - sigbits
const maxIterations = 1000
const fractByPopulations = 0.75

const naturalOrder = (a: number, b: number) => (a < b) ? -1 : ((a > b) ? 1 : 0)
const getColorIndex = (r: number, g: number, b: number) => (r << (2 * sigbits)) + (g << sigbits) + b

function createVBox(r1: number, r2: number, g1: number, g2: number, b1: number, b2: number, histogram: number[]) {
  let volume = 0
  let countSet = false
  let count = 0
  let avg: RGB | undefined
  return {
    r1,
    r2,
    g1,
    g2,
    b1,
    b2,
    histogram,
    volume(force = false) {
      if (!volume || force) {
        volume = ((this.r2 - this.r1 + 1) * (this.g2 - this.g1 + 1) * (this.b2 - this.b1 + 1))
      }
      return volume
    },
    count(force = false) {
      const histogram = this.histogram
      if (!countSet || force) {
        let npix = 0
        let i; let j; let k; let index
        for (i = this.r1; i <= this.r2; i++) {
          for (j = this.g1; j <= this.g2; j++) {
            for (k = this.b1; k <= this.b2; k++) {
              index = getColorIndex(i, j, k)
              npix += (histogram[index] || 0)
            }
          }
        }
        count = npix
        countSet = true
      }
      return count
    },
    copy() {
      return createVBox(this.r1, this.r2, this.g1, this.g2, this.b1, this.b2, this.histogram)
    },
    avg(force = false): RGB {
      const histogram = this.histogram
      if (!avg || force) {
        let ntot = 0
        const mult = 1 << (8 - sigbits)
        let rsum = 0
        let gsum = 0
        let bsum = 0
        let hval
        let i; let j; let k; let histoindex
        for (i = this.r1; i <= this.r2; i++) {
          for (j = this.g1; j <= this.g2; j++) {
            for (k = this.b1; k <= this.b2; k++) {
              histoindex = getColorIndex(i, j, k)
              hval = histogram[histoindex] || 0
              ntot += hval
              rsum += (hval * (i + 0.5) * mult)
              gsum += (hval * (j + 0.5) * mult)
              bsum += (hval * (k + 0.5) * mult)
            }
          }
        }
        if (ntot) {
          avg = [
            ~~(rsum / ntot),
            ~~(gsum / ntot),
            ~~(bsum / ntot),
          ] as RGB
        } else {
          avg = [
            ~~(mult * (this.r1 + this.r2 + 1) / 2),
            ~~(mult * (this.g1 + this.g2 + 1) / 2),
            ~~(mult * (this.b1 + this.b2 + 1) / 2),
          ] as RGB
        }
      }
      return avg as RGB
    },
  }
}

function createPQueue(comparator: (a: VBox, b: VBox) => number) {
  const contents: VBox[] = []
  let sorted = false
  function sort() {
    contents.sort(comparator)
    sorted = true
  }
  return {
    push(box: VBox) {
      contents.push(box)
      sorted = false
    },
    pop() {
      if (!sorted) sort()
      return contents.pop()
    },
    size() {
      return contents.length
    },
  }
}

function medianCutApply(histogram: number[], vbox: VBox) {
  if (!vbox.count()) return

  const rw = vbox.r2 - vbox.r1 + 1
  const gw = vbox.g2 - vbox.g1 + 1
  const bw = vbox.b2 - vbox.b1 + 1
  const maxw = Math.max(rw, gw, bw)
  if (vbox.count() === 1) {
    return [vbox.copy()]
  }
  let total = 0
  const partialsum: number[] = []
  const lookaheadsum: number[] = []
  let i; let j; let k; let sum; let index
  if (maxw === rw) {
    for (i = vbox.r1; i <= vbox.r2; i++) {
      sum = 0
      for (j = vbox.g1; j <= vbox.g2; j++) {
        for (k = vbox.b1; k <= vbox.b2; k++) {
          index = getColorIndex(i, j, k)
          sum += (histogram[index] || 0)
        }
      }
      total += sum
      partialsum[i] = total
    }
  } else if (maxw === gw) {
    for (i = vbox.g1; i <= vbox.g2; i++) {
      sum = 0
      for (j = vbox.r1; j <= vbox.r2; j++) {
        for (k = vbox.b1; k <= vbox.b2; k++) {
          index = getColorIndex(j, i, k)
          sum += (histogram[index] || 0)
        }
      }
      total += sum
      partialsum[i] = total
    }
  } else { /* maxw == bw */
    for (i = vbox.b1; i <= vbox.b2; i++) {
      sum = 0
      for (j = vbox.r1; j <= vbox.r2; j++) {
        for (k = vbox.g1; k <= vbox.g2; k++) {
          index = getColorIndex(j, k, i)
          sum += (histogram[index] || 0)
        }
      }
      total += sum
      partialsum[i] = total
    }
  }
  partialsum.forEach((d, i) => {
    lookaheadsum[i] = total - d
  })

  function doCut(color: 'r' | 'g' | 'b') {
    const dim1 = `${ color }1` as 'r1' | 'g1' | 'b1'
    const dim2 = `${ color }2` as 'r2' | 'g2' | 'b2'
    let left; let right; let vbox1; let vbox2; let d2; let count2 = 0
    for (i = vbox[dim1]; i <= vbox[dim2]; i++) {
      if (partialsum[i] > total / 2) {
        vbox1 = vbox.copy()
        vbox2 = vbox.copy()
        left = i - vbox[dim1]
        right = vbox[dim2] - i
        if (left <= right)
          d2 = Math.min(vbox[dim2] - 1, ~~(i + right / 2))
        else d2 = Math.max(vbox[dim1], ~~(i - 1 - left / 2))
        // avoid 0-count boxes
        while (!partialsum[d2]) d2++
        count2 = lookaheadsum[d2]
        while (!count2 && partialsum[d2 - 1]) count2 = lookaheadsum[--d2]
        // set dimensions
        vbox1[dim2] = d2
        vbox2[dim1] = vbox1[dim2] + 1
        return [vbox1, vbox2]
      }
    }
    return undefined
  }
  return maxw === rw
    ? doCut('r')
    : maxw === gw
      ? doCut('g')
      : doCut('b')
}

export function createColorTableByMmcq(pixels: Uint8ClampedArray, maxColors: number): { colorTable: RGB[]; findClosestRGB: undefined } {
  const pixelsLength = pixels.length

  if (!pixelsLength || maxColors < 2 || maxColors > 256) {
    return { colorTable: [], findClosestRGB: undefined }
  }

  let rmin = 1000000
  let rmax = 0
  let gmin = 1000000
  let gmax = 0
  let bmin = 1000000
  let bmax = 0
  const histogram = new Array(1 << (3 * sigbits))
  for (let i = 0; i < pixelsLength; i += 4) {
    const rval = pixels[i] >> rshift
    const gval = pixels[i + 1] >> rshift
    const bval = pixels[i + 2] >> rshift

    if (rval < rmin) rmin = rval
    else if (rval > rmax) rmax = rval
    if (gval < gmin) gmin = gval
    else if (gval > gmax) gmax = gval
    if (bval < bmin) bmin = bval
    else if (bval > bmax) bmax = bval

    const index = getColorIndex(rval, gval, bval)
    histogram[index] = (histogram[index] || 0) + 1
  }

  const vbox = createVBox(rmin, rmax, gmin, gmax, bmin, bmax, histogram)
  const pQueue = createPQueue((a, b) => naturalOrder(a.count(), b.count()))
  pQueue.push(vbox)

  function iterate(pQueue: PQueue, target: number) {
    let ncolors = 1
    let niters = 0
    while (niters < maxIterations) {
      const vbox = pQueue.pop()
      if (!vbox) return
      if (!vbox.count()) {
        pQueue.push(vbox)
        niters++
        continue
      }
      const vboxes = medianCutApply(histogram, vbox)
      const vbox1 = vboxes?.[0]
      const vbox2 = vboxes?.[1]
      if (!vbox1) return
      pQueue.push(vbox1)
      if (vbox2) {
        pQueue.push(vbox2)
        ncolors++
      }
      if (ncolors >= target) return
      if (niters++ > maxIterations) {
        return
      }
    }
  }

  iterate(pQueue, fractByPopulations * maxColors)

  const pQueue2 = createPQueue((a, b) => naturalOrder(a.count() * a.volume(), b.count() * b.volume()))

  while (pQueue.size()) {
    pQueue2.push(pQueue.pop()!)
  }

  iterate(pQueue2, maxColors - pQueue2.size())

  const colorTable: RGB[] = []
  while (pQueue2.size()) {
    colorTable.push(pQueue2.pop()!.avg())
  }

  return {
    colorTable,
    findClosestRGB: undefined,
  }
}
