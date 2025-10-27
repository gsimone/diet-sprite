import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    filters: 'src/filters.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  clean: true,
  external: [
    'three',
    'earcut',
  ],
  watch: process.argv.includes('--watch'),
})

