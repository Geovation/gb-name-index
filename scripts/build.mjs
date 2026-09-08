import { cp, mkdir } from 'node:fs/promises'
import { build as buildClient } from 'esbuild'
import { build as buildSite } from 'vite'

/** Shared esbuild options for each distributable client format. */
const options = {
  bundle: true,
  entryPoints: ['src/index.js'],
  minify: true,
  target: 'es2020'
}

await Promise.all([
  buildClient({ ...options, format: 'esm', outfile: 'dist/index.js' }),
  buildClient({ ...options, format: 'cjs', outfile: 'dist/index.cjs' }),
  buildClient({
    ...options,
    format: 'iife',
    globalName: 'NameIndex',
    outfile: 'dist/index.global.js'
  })
])

await buildSite({
  root: 'web',
  base: './',
  build: {
    outDir: '../build/harness-preview',
    emptyOutDir: true
  }
})

await mkdir('build/harness-preview/client', { recursive: true })
await cp('dist', 'build/harness-preview/client', { recursive: true })
