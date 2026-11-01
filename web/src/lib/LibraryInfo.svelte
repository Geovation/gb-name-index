<!-- Static library-usage reference displayed below the interactive search harness. -->
<script>
  const clientBundleSize = __CLIENT_BUNDLE_SIZE__;
</script>

<section class="library" aria-label="JavaScript library">
  <p class="eyebrow">Use the client</p>
  {#if clientBundleSize}
    <p>The client file is {clientBundleSize.gzipped} gzipped ({clientBundleSize.original} before compression).</p>
  {/if}
  <p>Search time starts after the typing pause and includes loading data and filtering results. It depends on your connection and which data is already cached.</p>
  <p>Pin the client to a GitHub release with npm. No registry account is needed:</p>
  <pre><code>npm install @geovation/gb-name-index@github:Geovation/gb-name-index#v0.1.0</code></pre>
  <p>Then import it in your app. The public index has no API key, service fee, backend, or hosting requirement.</p>
  <pre><code>import {`{ search }`} from "@geovation/gb-name-index";

const results = await search("Baker Street");</code></pre>
  <p class="eyebrow">Sample response</p>
  <p>Each result is a plain record. Empty fields are omitted, and optional <code>bbox</code> bounds are returned in west, south, east, north order.</p>
  <pre><code>&#123;
  "name": "Sample Park",
  "category": "park",
  "locality": "Sampleton",
  "region": "Example County",
  "longitude": -0.11,
  "latitude": 51.49,
  "bbox": [-0.11002, 51.48998, -0.10998, 51.49002],
  "source": "Sample: Overture Places"
&#125;</code></pre>
  <p><a href="../">Project documentation</a> · <a href="https://github.com/Geovation/gb-name-index/blob/main/docs/javascript-client.md">Client guide</a></p>
</section>
