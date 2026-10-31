<script>
  import { onMount } from "svelte";
  import { createNameIndex } from "../../src/index.js";

  import SearchInput from "./lib/SearchInput.svelte";
  import SearchResults from "./lib/SearchResults.svelte";
  import RefinementPanel from "./lib/RefinementPanel.svelte";
  import SelectedPlace from "./lib/SelectedPlace.svelte";
  import LibraryInfo from "./lib/LibraryInfo.svelte";

  import { toggle, move, resultMeta } from "./lib/utils.js";

  const index = createNameIndex({
    baseUrl: new URL("data", window.location.href).href,
    sourcePriority: ["OS Open Names", "Overture Places"],
  });

  let query = "";
  let results = [];
  let selected;
  let status = "Enter at least three characters.";
  let searchTimer;
  let activeRequest;
  let availableSources = ["OS Open Names", "Overture Places"];
  let typesBySource = {};
  let typeLabelsBySource = {};
  let selectedSources = [...availableSources];
  let selectedTypes = [];

  /** Count displayed records by normalized name for duplicate disambiguation. */
  $: resultNameCounts = results.reduce((counts, record) => {
    const normalizedName = record.NAME1.toLowerCase();
    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
    return counts;
  }, new Map());

  /** Count records by shared place context for coordinate disambiguation. */
  $: resultContextCounts = results.reduce((counts, record) => {
    const context = [record.NAME1, record.LOCALITY, record.POSTCODE_DISTRICT, record.REGION].join("|").toLowerCase();
    counts.set(context, (counts.get(context) ?? 0) + 1);
    return counts;
  }, new Map());

  /** Load source and type refinements published in the index manifest. */
  async function loadMetadata() {
    try {
      const manifest = await index.metadata();
      availableSources = manifest.sources;
      typesBySource = manifest.typesBySource ?? Object.fromEntries(manifest.sources.map((source) => [source, manifest.types ?? []]));
      typeLabelsBySource = manifest.typeLabelsBySource ?? {};
      selectedSources = [...manifest.sources];
    } catch {
      status = "The index settings could not be loaded.";
    }
  }

  onMount(loadMetadata);

  /**
   * Formats enough record context to distinguish similarly named places.
   *
   * @param {Record<string, string | number | undefined>} record - Search result to describe.
   * @returns {string} Display metadata for the result.
   */
  function formatMeta(record) {
    return resultMeta(record, typesBySource, typeLabelsBySource, resultNameCounts, resultContextCounts);
  }

  /**
   * Makes a result the current selection and clears the active result list.
   *
   * @param {Record<string, string | number | undefined>} record - Chosen search result.
   */
  function select(record) {
    query = record.NAME1;
    results = [];
    selected = record;
    status = "Place selected.";
  }

  /** Schedules a new search when the current query is long enough. */
  function refreshSearch() {
    if (query.trim().length >= 3) scheduleSearch();
  }

  /**
   * Toggles a source refinement and removes types unavailable from its sources.
   *
   * @param {string} source - Source to toggle.
   */
  function changeSources(source) {
    selectedSources = toggle(selectedSources, source);
    const allowedTypes = new Set(selectedSources.flatMap((selectedSource) => typesBySource[selectedSource] ?? []));
    selectedTypes = selectedTypes.filter((type) => allowedTypes.has(type));
    refreshSearch();
  }

  /**
   * Toggles a type refinement and schedules a new search.
   *
   * @param {string} type - Type to toggle.
   */
  function changeTypes(type) {
    selectedTypes = toggle(selectedTypes, type);
    refreshSearch();
  }

  /** Debounces a search, cancelling stale requests and handling empty refinements. */
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
   * Retrieves and renders the current query's matching records.
   *
   * @param {string} searchQuery - Trimmed query captured when the search was scheduled.
   * @returns {Promise<void>}
   */
  async function search(searchQuery) {
    activeRequest?.abort();
    activeRequest = new AbortController();
    status = "Searching index...";
    try {
      const matches = await index.search(searchQuery, {
        signal: activeRequest.signal,
        sources: selectedSources,
        types: selectedTypes.length ? selectedTypes : undefined,
        sourcePriority: selectedSources,
        typePriority: selectedTypes,
      });
      if (query.trim() !== searchQuery) return;
      results = matches.slice(0, 12);
      if (!matches.length) {
        status = "No matching places.";
      } else if (matches.moreAvailable) {
        status = `Showing first ${results.length} · keep typing to narrow`;
      } else {
        status = `${matches.length} matches`;
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

  <SearchInput {query} {status} onInput={scheduleSearch} />
  <SearchResults {results} onSelect={select} {formatMeta} />
  <RefinementPanel
    {availableSources}
    {selectedSources}
    {typesBySource}
    {typeLabelsBySource}
    {selectedTypes}
    onSourceChange={changeSources}
    onTypeChange={changeTypes}
    onSourceMove={(index, direction) => { selectedSources = move(selectedSources, index, direction); refreshSearch(); }}
    onTypeMove={(index, direction) => { selectedTypes = move(selectedTypes, index, direction); refreshSearch(); }}
  />
  <SelectedPlace {selected} />
  <LibraryInfo />
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    color: #18231f;
    background: #edf3eb;
    font-family: Georgia, "Times New Roman", serif;
  }

  main {
    width: min(100% - 32px, 680px);
    margin: 0 auto;
    padding: 12vh 0 64px;
  }

  header {
    margin-bottom: 36px;
  }

  h1 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: clamp(2.4rem, 7vw, 4.5rem);
    font-weight: 400;
    line-height: 0.95;
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

  .intro {
    max-width: 37rem;
    margin-top: 0;
    margin-bottom: 16px;
    color: #52625a;
    font-size: 1.1rem;
    line-height: 1.55;
  }

  @media (max-width: 480px) {
    main {
      padding-top: 8vh;
    }
  }
</style>