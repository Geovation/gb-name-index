<script>
  import { onMount } from "svelte";
  import { createNameIndex } from "../../src/index.js";

  import SearchInput from "./lib/SearchInput.svelte";
  import SearchResults from "./lib/SearchResults.svelte";
  import RefinementPanel from "./lib/RefinementPanel.svelte";
  import SelectedPlace from "./lib/SelectedPlace.svelte";
  import LibraryInfo from "./lib/LibraryInfo.svelte";

  import { toggle, move, resultMeta } from "./lib/utils.js";

  const indexBaseUrl = import.meta.env.VITE_NAME_INDEX_BASE_URL || (
    import.meta.env.DEV
      ? "/data"
      : new URL("../data", window.location.href).href
  );
  const index = createNameIndex({
    baseUrl: indexBaseUrl,
    sourcePriority: ["OS Open Names", "Overture Places"],
  });

  let query = "";
  let results = [];
  let selected;
  let status = "Enter at least three characters.";
  let searchTimer;
  let activeRequest;
  let availableSources = ["OS Open Names", "Overture Places"];
  let categoriesBySource = {};
  let categoryLabelsBySource = {};
  let selectedSources = [...availableSources];
  let selectedCategories = [];

  /** Count identical displayed names so repeated results can show more context. */
  $: resultNameCounts = results.reduce((counts, record) => {
    const normalizedName = record.name.toLowerCase();
    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
    return counts;
  }, new Map());

  /** Count records with the same locality and region to decide when coordinates help. */
  $: resultContextCounts = results.reduce((counts, record) => {
    const context = [record.name, record.locality, record.postcodeDistrict, record.region].join("|").toLowerCase();
    counts.set(context, (counts.get(context) ?? 0) + 1);
    return counts;
  }, new Map());

  /** Load the available filter choices from the manifest before the user searches. */
  async function loadMetadata() {
    try {
      const manifest = await index.metadata();
      availableSources = manifest.sources;
      categoriesBySource = manifest.categoriesBySource ?? Object.fromEntries(manifest.sources.map((source) => [source, manifest.categories ?? []]));
      categoryLabelsBySource = manifest.categoryLabelsBySource ?? {};
      selectedSources = [...manifest.sources];
    } catch {
      status = "The index settings could not be loaded.";
    }
  }

  onMount(loadMetadata);

  /**
    * Builds the short context line shown beneath each result name.
   *
   * @param {Record<string, string | number | undefined>} record - Search result to describe.
   * @returns {string} Display metadata for the result.
   */
  function formatMeta(record) {
    return resultMeta(record, categoryLabelsBySource, resultNameCounts, resultContextCounts);
  }

  /**
    * Opens a result's details and uses its name as the current search text.
   *
   * @param {Record<string, string | number | undefined>} record - Chosen search result.
   */
  function select(record) {
    query = record.name;
    results = [];
    selected = record;
    status = "Place selected.";
  }

  /** Re-run the current query after a source or category filter changes. */
  function refreshSearch() {
    if (query.trim().length >= 3) scheduleSearch();
  }

  /**
    * Changes the source filter and drops selected categories that no longer apply.
   *
   * @param {string} source - Source to toggle.
   */
  function changeSources(source) {
    selectedSources = toggle(selectedSources, source);
    const allowedCategories = new Set(selectedSources.flatMap((selectedSource) => categoriesBySource[selectedSource] ?? []));
    selectedCategories = selectedCategories.filter((category) => allowedCategories.has(category));
    refreshSearch();
  }

  /**
    * Changes the category filter and schedules the current query again.
   *
   * @param {string} category - Category to toggle.
   */
  function changeCategories(category) {
    selectedCategories = toggle(selectedCategories, category);
    refreshSearch();
  }

  /** Wait briefly between keystrokes, and stop searches that no longer apply. */
  function scheduleSearch() {
    clearTimeout(searchTimer);
    selected = undefined;
    results = [];
    const searchQuery = query.trim();
    if (!selectedSources.length) {
      activeRequest?.abort();
      status = "Choose at least one source.";
      return;
    }
    if (searchQuery.length < 3) {
      activeRequest?.abort();
      status = "Enter at least three characters.";
      return;
    }
    searchTimer = setTimeout(() => search(searchQuery), 180);
  }

  /**
    * Fetches matching records, ignores stale responses, and updates the result status.
   *
   * @param {string} searchQuery - Trimmed query captured when the search was scheduled.
   * @returns {Promise<void>}
   */
  async function search(searchQuery) {
    activeRequest?.abort();
    activeRequest = new AbortController();
    status = "Searching index...";
    const searchStartedAt = performance.now();
    try {
      const matches = await index.search(searchQuery, {
        signal: activeRequest.signal,
        sources: selectedSources,
        categories: selectedCategories.length ? selectedCategories : undefined,
        sourcePriority: selectedSources,
        categoryPriority: selectedCategories,
      });
      if (query.trim() !== searchQuery) return;
      const searchDuration = Math.round(performance.now() - searchStartedAt);
      results = matches.slice(0, 12);
      if (!matches.length) {
        status = `No matching places · ${searchDuration} ms`;
      } else if (matches.moreAvailable) {
        status = `Showing first ${results.length} · keep typing to narrow · ${searchDuration} ms`;
      } else {
        status = `${matches.length} matches · ${searchDuration} ms`;
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        results = [];
        status = "The index could not be searched.";
      }
    }
  }
</script>

<main>
  <header>
    <p class="eyebrow">Great Britain</p>
    <h1>GB Name Index</h1>
    <p class="intro">Search names for roads, postcodes, geographic features, settlements, and local points of interest.</p>
  </header>

  <SearchInput bind:query {status} onInput={scheduleSearch} />
  <SearchResults {results} onSelect={select} {formatMeta} />
  <RefinementPanel
    {availableSources}
    {selectedSources}
    {categoriesBySource}
    {categoryLabelsBySource}
    {selectedCategories}
    onSourceChange={changeSources}
    onCategoryChange={changeCategories}
    onSourceMove={(index, direction) => { selectedSources = move(selectedSources, index, direction); refreshSearch(); }}
    onCategoryMove={(index, direction) => { selectedCategories = move(selectedCategories, index, direction); refreshSearch(); }}
  />
  <SelectedPlace {selected} />
  <LibraryInfo />
</main>