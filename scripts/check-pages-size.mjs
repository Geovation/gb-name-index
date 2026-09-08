import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const [directory] = process.argv.slice(2)
const maximumSiteBytes = 900_000_000
const maximumFileBytes = 95 * 1024 * 1024

if (!directory) throw new Error('Provide the published index directory')

/**
 * Recursively collects every file size below a directory.
 *
 * @param {string} path - Directory to measure.
 * @returns {Promise<{total: number, files: Array<{path: string, size: number}>}>} Aggregate size and file details.
 */
async function measure (path) {
  let total = 0
  const files = []
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name)
    if (entry.isDirectory()) {
      const nested = await measure(entryPath)
      total += nested.total
      files.push(...nested.files)
    } else {
      const size = (await stat(entryPath)).size
      total += size
      files.push({ path: entryPath, size })
    }
  }
  return { total, files }
}

const { total, files } = await measure(directory)
const oversized = files.filter(({ size }) => size > maximumFileBytes)
if (total > maximumSiteBytes || oversized.length) {
  const problems = [
    total > maximumSiteBytes &&
      `Index size ${total} exceeds ${maximumSiteBytes} bytes`,
    ...oversized.map(({ path, size }) => `${path} is ${size} bytes`)
  ].filter(Boolean)
  throw new Error(problems.join('\n'))
}
console.log(`Index size: ${total} bytes across ${files.length} files`)
