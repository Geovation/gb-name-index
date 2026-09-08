<script>
  /** Search query, live status, and input callback supplied by the parent harness. */
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
    {onInput}
    aria-describedby="search-status"
  />
  <p id="search-status" class="status" aria-live="polite">{status}</p>
</section>

<style>
  .search-panel {
    border-top: 1px solid #b9c9bb;
    padding-top: 20px;
  }

  label {
    display: block;
    margin-bottom: 9px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 700;
  }

  input {
    width: 100%;
    border: 1px solid #83998a;
    border-radius: 4px;
    background: #fffefa;
    color: #18231f;
    font: inherit;
    font-size: 1.35rem;
    padding: 15px 16px;
  }

  input:focus {
    border-color: #1d5a3b;
    outline: 3px solid #b9dac1;
    outline-offset: 2px;
  }

  .status {
    min-height: 1.3rem;
    margin: 10px 0 0;
    color: #596a60;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.875rem;
  }
</style>
