import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { execFileSync } from 'node:child_process'

const pages = [
  ['docs/data-builders.md', 'Data builders'],
  ['docs/javascript-client.md', 'JavaScript client'],
  ['docs/search-harness.md', 'Search harness'],
  ['docs/testing.md', 'Tests'],
  ['docs/build-and-size-checks.md', 'Build and size checks'],
  ['docs/automation-and-releases.md', 'Automation and releases'],
  ['docs/attribution.md', 'Attribution'],
  ['docs/license.md', 'License']
]

test('Jekyll source uses GitHub Pages plugins for README and Markdown links', async () => {
  const config = await readFile('_config.yml', 'utf8')
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  const buildScript = await readFile('scripts/build.mjs', 'utf8')

  assert.match(config, /theme:\s*minima/)
  assert.match(config, /jekyll-readme-index/)
  assert.match(config, /jekyll-relative-links/)
  assert.match(config, /remove_originals:\s*true/)
  assert.equal(packageJson.devDependencies.marked, undefined)
  assert.doesNotMatch(buildScript, /build-docs|buildDocumentation/)

  const stylesheet = await readFile('assets/main.scss', 'utf8')
  assert.equal((stylesheet.match(/^---$/gm) ?? []).length, 2)
  assert.equal((stylesheet.match(/@import "minima";/g) ?? []).length, 1)

  const head = await readFile('_includes/head.html', 'utf8')
  assert.equal((head.match(/<head>/g) ?? []).length, 1)
  assert.match(head, /jekyll-mermaid\.js/)
  assert.doesNotMatch(head, /docs\.js/)

  const workflow = await readFile('.github/workflows/update-places.yml', 'utf8')
  assert.match(workflow, /actions\/jekyll-build-pages@v1/)
  assert.match(workflow, /web\/docs\.css web\/jekyll-mermaid\.js/)
  assert.match(workflow, /cp ATTRIBUTION\.md build\/pages-source\/_includes\/attribution\.md/)
  assert.match(workflow, /cp LICENSE build\/pages-source\/_includes\/license\.md/)
  assert.match(workflow, /actions\/deploy-pages@v4/)

  const attributionPage = await readFile('docs/attribution.md', 'utf8')
  const licensePage = await readFile('docs/license.md', 'utf8')
  assert.match(attributionPage, /{% include attribution\.md %}/)
  assert.match(licensePage, /{% include license\.md %}/)
  assert.doesNotMatch(`${attributionPage}\n${licensePage}`, /include_relative \.\.\//)

  for (const [path, title] of pages) {
    const markdown = await readFile(path, 'utf8')
    const frontMatter = markdown.match(/^---\nlayout: page\ntitle: .+\n---$/gm) ?? []
    assert.equal(frontMatter.length, 1, `${path} should have exactly one front-matter block`)
    assert.match(markdown, new RegExp(`^---\\nlayout: page\\ntitle: ${title.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\n---`, 'm'))
  }
})

test('every Mermaid diagram declares a caption', async () => {
  const sources = ['README.md', ...pages.map(([path]) => path)]

  for (const path of sources) {
    const markdown = await readFile(path, 'utf8')
    for (const [, body] of markdown.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)) {
      assert.match(body.split(/\r?\n/, 1)[0], /^%% caption:\s*.+/)
    }
  }
})

test('Catalyst export keeps guides flat and builds a harness against the public index', async () => {
  execFileSync('node', ['scripts/export-catalyst-docs.mjs'], { stdio: 'pipe' })

  const exportDirectory = 'build/catalyst-docs/gb-name-index'
  const entries = await readdir(exportDirectory, { withFileTypes: true })
  const pages = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md'))
  const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  const index = await readFile(`${exportDirectory}/index.md`, 'utf8')
  const builders = await readFile(`${exportDirectory}/data-builders.md`, 'utf8')
  const harness = await readFile(`${exportDirectory}/harness/index.html`, 'utf8')
  const bundles = await Promise.all(
    (await readdir(`${exportDirectory}/assets`))
      .filter(path => path.endsWith('.js'))
      .map(path => readFile(`${exportDirectory}/assets/${path}`, 'utf8'))
  )

  assert.equal(pages.length, 9)
  assert.deepEqual(directories, ['assets', 'harness'])
  assert.match(index, /has_children: true/)
  assert.match(index, /\[Open the interactive search harness\]\(harness\/\)/)
  assert.match(builders, /parent: "GB Name Index"/)
  assert.match(builders, /\]\(javascript-client\.html\)/)
  assert.match(harness, /\.\.\/assets\//)
  assert.ok(bundles.some(bundle => bundle.includes('https://geovation.github.io/gb-name-index/data')))
  assert.equal(entries.some(entry => entry.name === 'data'), false)
})