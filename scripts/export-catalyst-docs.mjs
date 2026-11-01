import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { build } from 'vite'

/** Exports flat Just the Docs pages and a harness that uses the public index. */
const exportDirectory = 'build/catalyst-docs/gb-name-index'
const dataUrl = 'https://geovation.github.io/gb-name-index/data'
const pages = [
  ['docs/data-builders.md', 'data-builders', 'Data builders'],
  ['docs/javascript-client.md', 'javascript-client', 'JavaScript client'],
  ['docs/search-harness.md', 'search-harness', 'Search harness'],
  ['docs/testing.md', 'testing', 'Tests'],
  ['docs/development.md', 'development', 'Develop and run tests'],
  ['docs/build-and-size-checks.md', 'build-and-size-checks', 'Build and size checks'],
  ['docs/automation-and-releases.md', 'automation-and-releases', 'Automation and releases'],
  ['docs/technologies-and-licenses.md', 'technologies-and-licenses', 'Technologies and licenses'],
  ['docs/attribution.md', 'attribution', 'Attribution'],
  ['docs/license.md', 'license', 'License']
]

/** Rewrites links to sibling Markdown pages as links to their Just the Docs pages. */
function rewriteLocalMarkdownLinks (markdown) {
  let inFence = false

  return markdown.split(/\r?\n/).map(line => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      return line
    }
    if (inFence) return line

    return line.replace(/\]\(([^)]+)\)/g, (link, target) => {
      const [path, suffix = ''] = target.split(/(?=[?#])/)
      if (path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path) || !path.endsWith('.md')) {
        return link
      }
      return `](${path.slice(0, -3)}.html${suffix})`
    })
  }).join('\n')
}

/** Removes a repeated first heading when the page theme already displays its title. */
function removePageHeading (markdown, title) {
  const lines = markdown.split('\n')
  const headingIndex = lines.findIndex(line => line.trim() !== '')
  const heading = lines[headingIndex]?.match(/^#\s+(.+?)\s*#*$/)?.[1]

  if (heading?.toLowerCase() === title.toLowerCase()) {
    lines.splice(headingIndex, 1)
  }

  return lines.join('\n').trimStart()
}

/** Adds the title and flat navigation settings required by Just the Docs. */
function pageFrontMatter (title, slug, navOrder) {
  return [
    '---',
    `title: "${title}"`,
    'parent: "GB Name Index"',
    `nav_order: ${navOrder}`,
    'published: true',
    `permalink: /gb-name-index/${slug}.html`,
    '---',
    ''
  ].join('\n')
}

await rm(exportDirectory, { recursive: true, force: true })
await mkdir(exportDirectory, { recursive: true })

process.env.VITE_NAME_INDEX_BASE_URL = dataUrl
await build({
  root: 'web',
  base: './',
  configFile: 'web/vite.config.js',
  build: {
    outDir: '../build/catalyst-docs/gb-name-index',
    emptyOutDir: false
  }
})

for (let index = 0; index < pages.length; index += 1) {
  const [sourcePath, slug, title] = pages[index]
  const source = await readFile(sourcePath, 'utf8')
  let content = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')

  if (sourcePath === 'docs/attribution.md') {
    content = await readFile('ATTRIBUTION.md', 'utf8')
  } else if (sourcePath === 'docs/license.md') {
    content = await readFile('LICENSE', 'utf8')
  }

  content = removePageHeading(content, title)
  content = rewriteLocalMarkdownLinks(content)
  await writeFile(
    `${exportDirectory}/${slug}.md`,
    `${pageFrontMatter(title, slug, index + 1)}${content.trimEnd()}\n`
  )
}

const indexPage = `---
title: "GB Name Index"
has_children: true
published: true
permalink: /gb-name-index/
---

A common searchable index built from OS Open Names and Overture Places.

[Open the interactive search harness](harness/)

[Project repository](https://github.com/Geovation/gb-name-index)
`
await writeFile(`${exportDirectory}/index.md`, indexPage)

const output = await readdir(exportDirectory)
console.log(`Exported ${pages.length + 1} flat Markdown pages and the harness to ${exportDirectory}`)
console.log(`Top-level export entries: ${output.sort().join(', ')}`)