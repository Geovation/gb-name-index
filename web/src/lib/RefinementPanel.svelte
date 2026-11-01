<script>
  import { ArrowDown, ArrowUp } from "@lucide/svelte";
  import { selectedCategoryLabel } from "./utils.js";

  /** Filter choices and callbacks; the parent app owns their selected values. */
  export let availableSources = [];
  export let selectedSources = [];
  export let categoriesBySource = {};
  export let categoryLabelsBySource = {};
  export let selectedCategories = [];
  export let onSourceChange = () => {};
  export let onCategoryChange = () => {};
  export let onSourceMove = () => {};
  export let onCategoryMove = () => {};

  let categoryQuery = "";

  /**
    * Shows the source's category label, with a readable fallback.
   *
   * @param {string} source - Source that defines the type.
   * @param {string} category - Category identifier to label.
   * @returns {string} User-facing category label.
   */
  function categoryLabel(source, category) {
    if (!category) return category;
    return categoryLabelsBySource[source]?.[category] ?? formatLabel(category);
  }

  /**
    * Makes an unlabelled identifier readable in the filter list.
   *
   * @param {string} label - Identifier to format.
   * @returns {string} Formatted label.
   */
  function formatLabel(label) {
    return label ? label.replaceAll("_", " ") : label;
  }

  /** Show only the selected sources' categories that match the filter text. */
  $: visibleCategoryGroups = selectedSources.map((source) => ({
    source,
    categories: (categoriesBySource[source] ?? []).filter((category) => categoryLabel(source, category).toLowerCase().includes(categoryQuery.trim().toLowerCase())),
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

  <section class="refinement-group" aria-labelledby="category-heading">
    <h2 id="category-heading">Categories</h2>
    <input class="category-filter" type="search" bind:value={categoryQuery} placeholder="Filter categories" aria-label="Filter categories" />
    <div class="category-choices">
      {#each visibleCategoryGroups as group}
        <section class="category-source-group" aria-label={`${group.source} categories`}>
          <h3>{group.source}</h3>
          <div class="choices">
            {#each group.categories as category}
              <label class="choice">
                <input type="checkbox" checked={selectedCategories.includes(category)} onchange={() => onCategoryChange(category)} />
                <span>{categoryLabel(group.source, category)}</span>
              </label>
            {/each}
          </div>
        </section>
      {/each}
    </div>
    {#if selectedCategories.length}
      <ol class="priority-list" aria-label="Category priority">
        {#each selectedCategories as category, index}
          <li>
            <span>{selectedCategoryLabel(category, selectedSources, categoriesBySource, categoryLabelsBySource)}</span>
            <button class="priority-button" type="button" aria-label={`Move ${category} up`} disabled={index === 0} onclick={() => onCategoryMove(index, -1)}><ArrowUp size={15} /></button>
            <button class="priority-button" type="button" aria-label={`Move ${category} down`} disabled={index === selectedCategories.length - 1} onclick={() => onCategoryMove(index, 1)}><ArrowDown size={15} /></button>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</details>
