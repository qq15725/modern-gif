import { resolve } from 'path'
import { defineConfig } from 'vite'

const resolvePath = (str: string) => resolve(__dirname, str)

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      name: 'encode-frame.worker',
      formats: ['iife'],
      fileName: () => 'encode-frame.worker.js',
      entry: resolvePath('./src/workers/encode-frame.worker.ts'),
    },
  },
})
