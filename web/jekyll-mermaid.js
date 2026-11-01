const blocks = document.querySelectorAll('.language-mermaid')

for (const block of blocks) {
  const code = block.querySelector('code') ?? block
  const [directive, ...lines] = code.textContent.split(/\r?\n/)
  const match = directive.match(/^%%\s*caption:\s*(.+)\s*$/)
  const figure = document.createElement('figure')
  const diagram = document.createElement('div')
  figure.className = 'diagram'
  diagram.className = 'mermaid'
  diagram.textContent = match ? lines.join('\n').trim() : code.textContent

  if (match) {
    diagram.setAttribute('role', 'img')
    diagram.setAttribute('aria-label', match[1])
    const caption = document.createElement('figcaption')
    caption.textContent = match[1]
    figure.append(diagram, caption)
  } else {
    figure.append(diagram)
  }

  const container = block.closest('.highlighter-rouge') ?? block.closest('pre') ?? block
  container.replaceWith(figure)
}

if (blocks.length) {
  const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
  mermaid.initialize({ startOnLoad: false, theme: 'neutral' })
  await mermaid.run({ querySelector: '.mermaid' })
}