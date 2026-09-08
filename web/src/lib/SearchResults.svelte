<script>
  /** Matching records, selection handler, and metadata formatter supplied by the parent harness. */
  export let results = [];
  export let onSelect = () => {};
  export let formatMeta = (record) => "";
</script>

{#if results.length}
  <ul class="results" aria-label="Matching places">
    {#each results as record}
      <li>
        <button type="button" onclick={() => onSelect(record)}>
          <span class="result-name">{record.NAME1}</span>
          <span class="result-meta">{formatMeta(record)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .results {
    max-height: 360px;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    border: 1px solid #83998a;
    border-radius: 4px;
    background: #fffefa;
    list-style: none;
  }

  .results button {
    display: grid;
    width: 100%;
    gap: 4px;
    border: 0;
    border-bottom: 1px solid #d6e0d6;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 12px 15px;
    text-align: left;
  }

  .results li:last-child button {
    border-bottom: 0;
  }

  .results button:hover,
  .results button:focus-visible {
    background: #e3efe5;
    outline: none;
  }

  .result-name {
    font-size: 1.05rem;
  }

  .result-meta {
    color: #587063;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.78rem;
  }
</style>
