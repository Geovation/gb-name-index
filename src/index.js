const defaultBaseUrl = 'https://geovation.github.io/gb-name-index/data'
const recordDictionaries = {
  category: 'categories',
  subtype: 'subtypes',
  locality: 'localities',
  postcodeDistrict: 'postcodeDistricts',
  region: 'regions',
  source: 'sources'
}

/** Credits and license links to show when using records from this index. */
export const dataAttribution = Object.freeze({
  osOpenNames: `Contains OS data \u00a9 Crown copyright and database rights Ordnance Survey ${new Date().getFullYear()}.`,
  osOpenNamesSource: 'https://www.ordnancesurvey.co.uk/products/os-open-names',
  osOpenNamesLicense: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  overturePlaces: 'Overture Maps Foundation, overturemaps.org',
  overtureLicense: 'CDLA-Permissive-2.0 and Apache-2.0, depending on source.',
  overtureLicenseDetails: 'https://docs.overturemaps.org/guides/places/',
  overtureAttribution: 'https://docs.overturemaps.org/attribution/'
})

/**
 * Makes a query comparable with indexed names by lowercasing it and removing
 * spaces, punctuation, and other non-alphanumeric characters.
 *
 * @param {unknown} query - Value to normalize.
 * @returns {string} The lowercase alphanumeric representation of the value.
 */
export function normalize (query) {
  return String(query ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Turns an ordered preference list into ranks used when sorting results.
 *
 * @param {string[]} [values=[]] - Values ordered from highest to lowest priority.
 * @returns {Map<string, number>} Value-to-priority mapping.
 */
function buildPriorityMap (values = []) {
  return new Map(values.map((value, index) => [value, index]))
}

/**
 * Returns a value's rank, placing values not named by the caller last.
 *
 * @param {string} value - Value whose priority is required.
 * @param {Map<string, number>} priorities - Value-to-priority mapping.
 * @returns {number} Numeric priority for sorting.
 */
function getPriorityRank (value, priorities) {
  return priorities.get(value) ?? priorities.size
}

/**
 * Sorts exact-name matches first, then applies the caller's source and category
 * preferences. The final fields make ties sort consistently between searches.
 *
 * @param {string} query - Original search query.
 * @param {Map<string, number>} sourcePriorities - Source ranking map.
 * @param {Map<string, number>} categoryPriorities - Category ranking map.
 * @returns {(left: Record<string, unknown>, right: Record<string, unknown>) => number} Record comparator.
 */
function compareRecordsByPriority (query, sourcePriorities, categoryPriorities) {
  const normalizedQuery = normalize(query)
  return (left, right) => {
    const exactNameDifference =
      Number(normalize(right.name) === normalizedQuery) -
      Number(normalize(left.name) === normalizedQuery)
    if (exactNameDifference) return exactNameDifference

    const sourceDifference =
      getPriorityRank(left.source, sourcePriorities) -
      getPriorityRank(right.source, sourcePriorities)
    if (sourceDifference) return sourceDifference

    const typeDifference =
      getPriorityRank(left.category, categoryPriorities) -
      getPriorityRank(right.category, categoryPriorities)
    if (typeDifference) return typeDifference

    return ['name', 'locality', 'region', 'category', 'subtype', 'source'].reduce(
      (difference, field) =>
        difference ||
        String(left[field] ?? '').localeCompare(String(right[field] ?? '')),
      0
    )
  }
}

/**
 * Creates a client that reads and searches the static GB name index.
 *
 * @param {object} [options={}] - Settings for this client instance.
 * @param {string} [options.baseUrl] - Folder URL containing `index.json` and its shard files.
 * @param {typeof fetch} [options.fetch] - Fetch function; defaults to the runtime's global `fetch`.
 * @param {string[]} [options.sourcePriority] - Sources to rank first, in display order.
 * @param {string[]} [options.categoryPriority] - Categories to rank first, in display order.
 * @returns {{search: Function, metadata: Function, clearCache: Function}} Client methods with an independent request cache.
 * @throws {TypeError} If the runtime does not provide `fetch` and none is passed in `options`.
 */
export function createNameIndex ({
  baseUrl = defaultBaseUrl,
  fetch: fetcher = globalThis.fetch,
  sourcePriority = ['OS Open Names', 'Overture Places'],
  categoryPriority = []
} = {}) {
  if (typeof fetcher !== 'function') {
    throw new TypeError('A fetch implementation is required')
  }

  const cache = new Map()
  const base = baseUrl.replace(/\/+$/, '')
  const defaultSourcePriorities = buildPriorityMap(sourcePriority)
  const defaultCategoryPriorities = buildPriorityMap(categoryPriority)
  let manifestRequest

  /**
    * Fetches `index.json` once and reuses it for later calls from this client.
   *
    * @param {AbortSignal} [signal] - Cancels the fetch if this call starts it.
    * @returns {Promise<Record<string, unknown>>} Manifest describing the data and its shard layout.
   */
  function loadManifest (signal) {
    if (!manifestRequest) {
      manifestRequest = fetcher(`${base}/index.json`, { signal })
        .then(async response => {
          if (!response.ok)
            throw new Error(`Could not load index manifest: ${response.status}`)
          return response.json()
        })
        .catch(error => {
          manifestRequest = undefined
          throw error
        })
    }
    return manifestRequest
  }

  /**
    * Fetches one result shard and shares that request with later searches.
   *
    * @param {string} prefix - Prefix used as the shard file name.
    * @param {AbortSignal} [signal] - Cancels the fetch if this call starts it.
    * @returns {Promise<unknown[][]>} Compact rows, or an empty list when the shard does not exist.
   */
  async function loadShard (prefix, signal) {
    if (!cache.has(prefix)) {
      const request = fetcher(`${base}/${encodeURIComponent(prefix)}.json`, {
        signal
      })
        .then(async response => {
          if (response.status === 404) return []
          if (!response.ok)
            throw new Error(
              `Could not load prefix ${prefix}: ${response.status}`
            )
          return response.json()
        })
        .catch(error => {
          cache.delete(prefix)
          throw error
        })
      cache.set(prefix, request)
    }
    return cache.get(prefix)
  }

  /**
    * Turns one compact row back into a record with field names.
   *
    * @param {unknown[]} row - Values in the order listed by the manifest schema.
    * @param {{schema: string[], [key: string]: unknown}} manifest - Field names and lookup tables for compact row values.
    * @returns {Record<string, unknown>} Record with named fields and empty values removed.
   */
  function decodeRecord (row, manifest) {
    return Object.fromEntries(
      manifest.schema
        .map((field, index) => {
          const dictionaryName = recordDictionaries[field]
          const dictionary = dictionaryName ? manifest[dictionaryName] : undefined
          return [
            field,
            Array.isArray(dictionary) && Number.isInteger(row[index])
              ? dictionary[row[index]]
              : row[index]
          ]
        })
        .filter(
          ([, value]) => value !== null && value !== undefined && value !== ''
        )
    )
  }

  /**
    * Finds which shard or route can answer a normalized query.
   *
    * A leaf contains the query's rows. If the query ends at a branch, the caller
    * must visit child shards to build a limited preview.
   *
    * @param {string} prefix - Query after name normalization.
    * @param {Record<string, unknown>} manifest - Routing rules and minimum query length.
    * @returns {{kind: 'none'} | {kind: 'leaf', shard: string} | {kind: 'preview', node: string}} How to fetch matches for this query.
   */
  function planSearchRoute (prefix, manifest) {
    const minimumLength =
      manifest.minimumQueryLength ?? manifest.shardLength ?? 3
    if (prefix.length < minimumLength) return { kind: 'none' }
    const routes = manifest.routes ?? {}
    let node = prefix.slice(0, minimumLength)
    while (prefix.length > node.length && Object.hasOwn(routes, node)) {
      const nextCharacter = prefix[node.length]
      if (!routes[node].includes(nextCharacter)) return { kind: 'none' }
      node += nextCharacter
    }
    if (!Object.hasOwn(routes, node)) return { kind: 'leaf', shard: node }
    return { kind: 'preview', node }
  }

  /**
    * Reads child shards in a stable order until the preview has enough records.
   *
    * Every child belongs to the query prefix. Search applies source and category
    * filters after these rows have been collected.
   *
    * @param {string} node - Branch prefix whose child shards contain the matches.
    * @param {Record<string, unknown>} manifest - Child-shard routing rules.
    * @param {number} previewLimit - Target number of rows before traversal stops.
    * @param {AbortSignal} [signal] - Cancels any child-shard fetch started here.
    * @returns {Promise<{rows: unknown[][], moreAvailable: boolean}>} Preview rows and whether another child remains.
   */
  async function collectPreviewRows (node, manifest, previewLimit, signal) {
    const routes = manifest.routes ?? {}
    const queue = [...routes[node]].sort().map(character => node + character)
    const rows = []
    while (queue.length && rows.length < previewLimit) {
      const candidate = queue.shift()
      if (Object.hasOwn(routes, candidate)) {
        queue.unshift(
          ...[...routes[candidate]]
            .sort()
            .map(character => candidate + character)
        )
        continue
      }
      rows.push(...(await loadShard(candidate, signal)))
    }
    return { rows, moreAvailable: queue.length > 0 }
  }

  return Object.freeze({
    /**
      * Finds names that begin with the query after punctuation and spacing are ignored.
     *
      * @param {string} query - Name or beginning of a name to find.
      * @param {object} [options={}] - Optional filters, ranking preferences, and cancellation signal.
      * @param {AbortSignal} [options.signal] - Stops the manifest or shard request started by this search.
      * @param {string[]} [options.sources] - Only return records from these datasets.
      * @param {string[]} [options.categories] - Only return records in these broad categories.
      * @param {number} [options.previewLimit=20] - Target size when the query matches a branch with multiple shards.
      * @param {string[]} [options.sourcePriority] - Sources to rank first, in display order.
      * @param {string[]} [options.categoryPriority] - Categories to rank first, in display order.
      * @returns {Promise<Array<Record<string, unknown>> & {moreAvailable?: boolean}>} Sorted records; `moreAvailable` marks previews or capped exact-name groups.
     */
    async search (
      query,
      {
        signal,
        sources,
        categories,
        previewLimit = 20,
        sourcePriority: searchSourcePriority = sourcePriority,
        categoryPriority: searchCategoryPriority = categoryPriority
      } = {}
    ) {
      const prefix = normalize(query)
      const manifest = await loadManifest(signal)
      const plan = planSearchRoute(prefix, manifest)
      let rows = []
      let moreAvailable = false
      if (plan.kind === 'leaf') {
        rows = await loadShard(plan.shard, signal)
        moreAvailable = Object.hasOwn(manifest.truncated ?? {}, plan.shard)
      } else if (plan.kind === 'preview') {
        ;({ rows, moreAvailable } = await collectPreviewRows(
          plan.node,
          manifest,
          previewLimit,
          signal
        ))
      } else {
        return Object.assign([], { moreAvailable: false })
      }
      const sourcePriorities =
        searchSourcePriority === sourcePriority
          ? defaultSourcePriorities
          : buildPriorityMap(searchSourcePriority)
      const categoryPriorities =
        searchCategoryPriority === categoryPriority
          ? defaultCategoryPriorities
          : buildPriorityMap(searchCategoryPriority)
      const sourceFilter = sources === undefined ? undefined : new Set(sources)
      const categoryFilter = categories === undefined ? undefined : new Set(categories)
      const results = rows
        .map(row => decodeRecord(row, manifest))
        .filter(
          record =>
            normalize(record.name).startsWith(prefix) &&
            (!sourceFilter || sourceFilter.has(record.source)) &&
            (!categoryFilter || categoryFilter.has(record.category))
        )
          .sort(compareRecordsByPriority(query, sourcePriorities, categoryPriorities))
      return Object.assign(results, { moreAvailable })
    },
    /**
      * Returns index details such as available filters, sources, and shard routes.
     *
      * @param {object} [options={}] - Request settings.
      * @param {AbortSignal} [options.signal] - Cancels the fetch if this call loads the manifest.
      * @returns {Promise<Record<string, unknown>>} The manifest, cached for this client.
     */
    metadata ({ signal } = {}) {
      return loadManifest(signal)
    },
    /** Forget the manifest and shards so the next search loads current files. */
    clearCache () {
      cache.clear()
      manifestRequest = undefined
    }
  })
}

/** Shared client that searches the current GitHub Pages index. */
export const nameIndex = createNameIndex()
/** Convenience function that searches with the shared default client. */
export const search = nameIndex.search
