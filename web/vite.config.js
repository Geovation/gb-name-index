import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const localIndexExists = existsSync(
  fileURLToPath(new URL('../build/data/index.json', import.meta.url))
)

/** Measures the published ESM client's original and gzip-compressed sizes. */
function measureClientBundle () {
  const bundlePath = fileURLToPath(new URL('../dist/index.js', import.meta.url))
  if (!existsSync(bundlePath)) return null

  const bundle = readFileSync(bundlePath)
  const formatKilobytes = bytes => `${(bytes / 1000).toFixed(1)} kB`
  return {
    original: formatKilobytes(bundle.length),
    gzipped: formatKilobytes(gzipSync(bundle).length)
  }
}

/**
 * Creates the Vite configuration for local and published harness builds.
 *
 * During development, expose the repository's build directory so a local index
 * can be searched. Production emits the harness under `harness/`; the publishing
 * workflow places the generated data beside that directory.
 *
 * @param {'serve' | 'build'} command - Vite command being executed.
 * @returns {import('vite').UserConfig} Vite configuration for the harness.
 */
function createHarnessConfig (command) {
  return {
    plugins: [svelte()],
    define: {
      __CLIENT_BUNDLE_SIZE__: JSON.stringify(measureClientBundle())
    },
    publicDir: command === 'serve'
      ? localIndexExists ? '../build' : 'public'
      : false,
    build: command === 'build'
      ? { rollupOptions: { input: 'harness/index.html' } }
      : undefined
  }
}

export default defineConfig(({ command }) => createHarnessConfig(command))
