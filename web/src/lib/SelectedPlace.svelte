<script>
  /** Currently selected record supplied by the parent harness. */
  export let selected = null;

  /**
   * Converts an underscore-separated field identifier to a display label.
   *
   * @param {string} label - Field identifier to format.
   * @returns {string} Formatted field label.
   */
  function formatLabel(label) {
    return label ? label.replaceAll("_", " ") : label;
  }

  /**
   * Selects non-empty record fields suitable for the details list.
   *
   * @param {Record<string, string | number | undefined>} record - Selected place record.
   * @returns {Array<[string, string | number]>} Displayable label and value pairs.
   */
  function detailsFor(record) {
    return Object.entries(record).filter(([label, value]) => value && label !== "NAME1");
  }
</script>

{#if selected}
  <section class="selection" aria-live="polite">
    <p class="eyebrow">Selected result</p>
    <h2>{selected.NAME1}</h2>
    <dl>
      {#each detailsFor(selected) as [label, value]}
        <dt>{formatLabel(label)}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
  </section>
{/if}

<style>
  .selection {
    margin-top: 42px;
    border-top: 1px solid #b9c9bb;
    padding-top: 20px;
  }

  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: clamp(1.7rem, 5vw, 2.6rem);
    font-weight: 400;
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

  dl {
    display: grid;
    grid-template-columns: minmax(105px, 0.3fr) 1fr;
    gap: 10px 18px;
    margin: 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  dt {
    color: #557160;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
