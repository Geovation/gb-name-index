<script>
  import { ArrowDown, ArrowUp } from "@lucide/svelte";

  /** Sources, types, and callbacks used to refine and rank search results. */
  export let availableSources = [];
  export let selectedSources = [];
  export let typesBySource = {};
  export let typeLabelsBySource = {};
  export let selectedTypes = [];
  export let onSourceChange = () => {};
  export let onTypeChange = () => {};
  export let onSourceMove = () => {};
  export let onTypeMove = () => {};

  let typeQuery = "";

  /**
   * Resolves a source-specific display label for a type identifier.
   *
   * @param {string} source - Source that defines the type.
   * @param {string} type - Type identifier to label.
   * @returns {string} User-facing type label.
   */
  function typeLabel(source, type) {
    if (!type) return type;
    return typeLabelsBySource[source]?.[type] ?? formatLabel(type);
  }

  /**
   * Converts an underscore-separated identifier to a display label.
   *
   * @param {string} label - Identifier to format.
   * @returns {string} Formatted label.
   */
  function formatLabel(label) {
    return label ? label.replaceAll("_", " ") : label;
  }

  /** Groups source types after filtering them against the current type query. */
  $: visibleTypeGroups = selectedSources.map((source) => ({
    source,
    types: (typesBySource[source] ?? []).filter((type) => typeLabel(source, type).toLowerCase().includes(typeQuery.trim().toLowerCase())),
  }));
</script>

<details class="refinements">
  <summary>Refine results</summary>
  
  <section class="refinement-group" aria-labelledby="source-heading">
    <h2 id="source-heading">Sources</h2>
    <div class="choices">
      {#each availableSources as source}
        <label class="choice">
          <input type="checkbox" checked={selectedSources.includes(source)} onchange={() => onSourceChange(source)} />
          <span>{source}</span>
        </label>
      {/each}
    </div>
    {#if selectedSources.length > 1}
      <ol class="priority-list" aria-label="Source priority">
        {#each selectedSources as source, index}
          <li>
            <span>{source}</span>
            <button class="priority-button" type="button" aria-label={`Move ${source} up`} disabled={index === 0} onclick={() => onSourceMove(index, -1)}><ArrowUp size={15} /></button>
            <button class="priority-button" type="button" aria-label={`Move ${source} down`} disabled={index === selectedSources.length - 1} onclick={() => onSourceMove(index, 1)}><ArrowDown size={15} /></button>
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  <section class="refinement-group" aria-labelledby="type-heading">
    <h2 id="type-heading">Types</h2>
    <input class="type-filter" type="search" bind:value={typeQuery} placeholder="Filter types" aria-label="Filter types" />
    <div class="type-choices">
      {#each visibleTypeGroups as group}
        <section class="type-source-group" aria-label={`${group.source} types`}>
          <h3>{group.source}</h3>
          <div class="choices">
            {#each group.types as type}
              <label class="choice">
                <input type="checkbox" checked={selectedTypes.includes(type)} onchange={() => onTypeChange(type)} />
                <span>{typeLabel(group.source, type)}</span>
              </label>
            {/each}
          </div>
        </section>
      {/each}
    </div>
    {#if selectedTypes.length}
      <ol class="priority-list" aria-label="Type priority">
        {#each selectedTypes as type, index}
          <li>
            <span>{formatLabel(type)}</span>
            <button class="priority-button" type="button" aria-label={`Move ${type} up`} disabled={index === 0} onclick={() => onTypeMove(index, -1)}><ArrowUp size={15} /></button>
            <button class="priority-button" type="button" aria-label={`Move ${type} down`} disabled={index === selectedTypes.length - 1} onclick={() => onTypeMove(index, 1)}><ArrowDown size={15} /></button>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</details>

<style>
  .refinements {
    margin-top: 18px;
    border-top: 1px solid #b9c9bb;
    color: #52625a;
    font-family: ui-sans-serif, system-ui, sans-serif;
    padding-top: 14px;
  }

  summary {
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .refinement-group {
    margin-top: 20px;
  }

  .refinement-group h2 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1rem;
  }

  .choices {
    display: grid;
    gap: 6px;
  }

  .type-choices {
    max-height: 180px;
    overflow-y: auto;
    padding-right: 8px;
  }

  .type-source-group + .type-source-group {
    margin-top: 16px;
  }

  .type-source-group h3 {
    margin: 0 0 8px;
    color: #557160;
    font-size: 0.8rem;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: #18231f;
    font-size: 0.875rem;
    font-weight: 400;
  }

  .choice input {
    width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
  }

  .type-filter {
    width: 100%;
    margin-bottom: 10px;
    padding: 8px 10px;
    font-size: 0.875rem;
    border: 1px solid #83998a;
    border-radius: 4px;
    background: #fffefa;
  }

  .type-filter:focus {
    border-color: #1d5a3b;
    outline: 3px solid #b9dac1;
    outline-offset: 2px;
  }

  .priority-list {
    display: grid;
    gap: 4px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .priority-list li {
    display: grid;
    grid-template-columns: 1fr 30px 30px;
    align-items: center;
    border-top: 1px solid #d6e0d6;
    padding: 7px 0;
    font-size: 0.8rem;
  }

  .priority-button {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border: 1px solid #83998a;
    border-radius: 4px;
    background: #fffefa;
    color: #1d5a3b;
    cursor: pointer;
  }

  .priority-button:disabled {
    cursor: default;
    opacity: 0.4;
  }
</style>
