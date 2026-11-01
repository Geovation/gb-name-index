<script>
  /** The parent app's current result, or null when no result is selected. */
  export let selected = null;

  /**
    * Makes field names such as `postcodeDistrict` readable in the details list.
   *
   * @param {string} label - Field identifier to format.
   * @returns {string} Formatted field label.
   */
  function formatLabel(label) {
    const knownLabels = {
      category: "Category",
      subtype: "Subtype",
      locality: "Locality",
      postcodeDistrict: "Postcode district",
      region: "Region",
      longitude: "Longitude",
      latitude: "Latitude",
      bbox: "Bounds (west, south, east, north)",
      source: "Source",
    };
    return knownLabels[label] ?? label;
  }

  /**
    * Keeps fields that have a value and leaves the name as the details heading.
   *
   * @param {Record<string, string | number | undefined>} record - Selected place record.
   * @returns {Array<[string, string | number]>} Displayable label and value pairs.
   */
  function detailsFor(record) {
    return Object.entries(record).filter(([label, value]) => value != null && value !== "" && label !== "name");
  }
</script>

{#if selected}
  <section class="selection" aria-live="polite">
    <p class="eyebrow">Selected result</p>
    <h2>{selected.name}</h2>
    <dl>
      {#each detailsFor(selected) as [label, value]}
        <dt>{formatLabel(label)}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
  </section>
{/if}
