<script>
  /** The parent owns the query and status; this component only reports input changes. */
  export let query = "";
  export let status = "";
  export let onInput;
</script>

<section class="search-panel" aria-label="Name search">
  <label for="place-search">Search names</label>
  <input
    id="place-search"
    name="place-search"
    type="search"
    autocomplete="off"
    placeholder="Try Baker Street or St John's"
    bind:value={query}
    oninput={onInput}
    aria-describedby="search-status"
  />
  <p id="search-status" class="status" aria-live="polite">{status}</p>
</section>
