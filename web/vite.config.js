import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

/**
 * Creates the Vite configuration for the interactive name-index harness.
 *
 * Development serves generated index data from the repository build directory;
 * production builds receive those files through the root build script instead.
 *
 * @param {'serve' | 'build'} command - Vite command being executed.
 * @returns {import('vite').UserConfig} Vite configuration for the harness.
 */
function createHarnessConfig (command) {
  return {
    plugins: [svelte()],
    publicDir: command === 'serve' ? '../build' : false
  }
}

export default defineConfig(({ command }) => createHarnessConfig(command))
