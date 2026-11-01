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
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      background: '#ffffff',
      primaryColor: '#e8f1ff',
      primaryTextColor: '#172b4d',
      primaryBorderColor: '#4669a8',
      lineColor: '#52637a',
      secondaryColor: '#e5f5ee',
      tertiaryColor: '#fff1d6',
      clusterBkg: '#f0f5fb',
      clusterBorder: '#bfccdf',
      edgeLabelBackground: '#ffffff',
      actorBkg: '#e8f1ff',
      actorBorder: '#4669a8',
      actorTextColor: '#172b4d',
      actorLineColor: '#52637a',
      signalColor: '#52637a',
      signalTextColor: '#172b4d',
      labelBoxBkgColor: '#fff1d6',
      labelBoxBorderColor: '#d99a2b',
      labelTextColor: '#172b4d',
      loopTextColor: '#172b4d'
    },
    flowchart: { curve: 'linear', nodeSpacing: 40, rankSpacing: 55 },
    sequence: { actorMargin: 40, messageMargin: 30 }
  })
  await mermaid.run({ querySelector: '.mermaid' })
}