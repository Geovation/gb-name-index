<script>
  /** Records and callbacks supplied by the parent app; this component only renders and selects. */
  export let results = [];
  export let onSelect = () => {};
  export let formatMeta = (record) => "";
</script>

{#if results.length}
  <ul class="results" aria-label="Matching places">
    {#each results as record}
      <li>
        <button type="button" onclick={() => onSelect(record)}>
          <span class="result-name">{record.name}</span>
          <span class="result-meta">{formatMeta(record)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
