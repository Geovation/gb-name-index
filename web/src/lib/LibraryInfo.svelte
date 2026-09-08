<!-- Static library-usage reference displayed below the interactive search harness. -->
<section class="library" aria-label="JavaScript library">
  <p class="eyebrow">JavaScript</p>
  <p>Use the same small browser or server-side client behind this example.</p>
  <pre><code>import {`{ search }`} from "@geovation/gb-name-index";

const results = await search("Baker Street");</code></pre>
  <p><a href="https://github.com/Geovation/gb-name-index#javascript-client">Library documentation</a> · <a href="https://github.com/Geovation/gb-name-index">Source repository</a></p>
</section>

<style>
  .library {
    margin-top: 42px;
    border-top: 1px solid #b9c9bb;
    color: #52625a;
    padding-top: 20px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #557160;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  p {
    margin-top: 0;
    margin-bottom: 16px;
    color: #52625a;
  }

  .library pre {
    margin: 16px 0;
    overflow-x: auto;
    border: 1px solid #b9c9bb;
    border-radius: 4px;
    background: #f8faf5;
    color: #18231f;
    padding: 14px;
    font: 0.8rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .library a {
    color: #1d5a3b;
  }
</style>
