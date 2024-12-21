export function deinterlace(pixels: number[], width: number): number[] {
  const newPixels: number[] = Array.from({ length: pixels.length })
  const rows = pixels.length / width
  // See appendix E.
  const offsets = [0, 4, 2, 1]
  const steps = [8, 8, 4, 2]

  let fromRow = 0
  for (let pass = 0; pass < 4; pass++) {
    for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
      // eslint-disable-next-line prefer-spread
      newPixels.splice.apply(
        newPixels,
        ([toRow * width, width] as any).concat(
          pixels.slice(fromRow * width, (fromRow + 1) * width),
        ),
      )
      fromRow++
    }
  }

  return newPixels
}
