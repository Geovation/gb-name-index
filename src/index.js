const defaultBaseUrl = 'https://geovation.github.io/gb-name-index/data/names'

/**
 * Normalizes a search term or name for case-insensitive prefix matching.
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
 * Maps values to their ranking position in a priority list.
 *
 * @param {string[]} [values=[]] - Values ordered from highest to lowest priority.
 * @returns {Map<string, number>} Value-to-priority mapping.
 */
function priorityMap (values = []) {
  return new Map(values.map((value, index) => [value, index]))
}

/**
 * Gets a value's priority, placing unlisted values after all listed values.
 *
 * @param {string} value - Value whose priority is required.
 * @param {Map<string, number>} priorities - Value-to-priority mapping.
 * @returns {number} Numeric priority for sorting.
 */
function priorityOf (value, priorities) {
  return priorities.get(value) ?? priorities.size
}

/**
 * Builds a deterministic record comparator for a query and configured priorities.
 *
 * @param {string} query - Original search query.
 * @param {Map<string, number>} sourcePriorities - Source ranking map.
 * @param {Map<string, number>} typePriorities - Type ranking map.
 * @returns {(left: Record<string, unknown>, right: Record<string, unknown>) => number} Record comparator.
 */
function compareRecords (query, sourcePriorities, typePriorities) {
  const normalizedQuery = normalize(query)
  return (left, right) => {
    const exactNameDifference =
      Number(normalize(right.NAME1) === normalizedQuery) -
      Number(normalize(left.NAME1) === normalizedQuery)
    if (exactNameDifference) return exactNameDifference

    const sourceDifference =
      priorityOf(left.SOURCE, sourcePriorities) -
      priorityOf(right.SOURCE, sourcePriorities)
    if (sourceDifference) return sourceDifference

    const typeDifference =
      priorityOf(left.TYPE, typePriorities) -
      priorityOf(right.TYPE, typePriorities)
    if (typeDifference) return typeDifference

    return ['NAME1', 'LOCALITY', 'REGION', 'TYPE', 'SOURCE'].reduce(
      (difference, field) =>
        difference ||
        String(left[field] ?? '').localeCompare(String(right[field] ?? '')),
      0
    )
  }
}

/**
 * Creates a client for the static Great Britain name prefix index.
 *
 * @param {object} [options={}] - Client configuration.
 * @param {string} [options.baseUrl] - URL of the directory containing index shards.
 * @param {typeof fetch} [options.fetch] - Fetch implementation used to request index files.
 * @param {string[]} [options.sourcePriority] - Default source ranking.
 * @param {string[]} [options.typePriority] - Default type ranking.
 * @returns {{search: Function, metadata: Function, clearCache: Function}} Frozen name-index client.
 * @throws {TypeError} When no fetch implementation is supplied.
 */
export function createNameIndex ({
  baseUrl = defaultBaseUrl,
  fetch: fetcher = globalThis.fetch,
  sourcePriority = ['OS Open Names', 'Overture Places'],
  typePriority = []
} = {}) {
  if (typeof fetcher !== 'function') {
    throw new TypeError('A fetch implementation is required')
  }

  const cache = new Map()
  const base = baseUrl.replace(/\/+$/, '')
  const defaultSourcePriorities = priorityMap(sourcePriority)
  const defaultTypePriorities = priorityMap(typePriority)
  let manifestRequest

  /**
   * Loads and caches the index manifest.
   *
   * @param {AbortSignal} [signal] - Signal used to cancel the initial request.
   * @returns {Promise<Record<string, unknown>>} Index manifest.
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
   * Loads and caches one leaf shard of encoded records.
   *
   * @param {string} prefix - Leaf-shard prefix.
   * @param {AbortSignal} [signal] - Signal used to cancel the initial request.
   * @returns {Promise<unknown[][]>} Encoded record rows, or an empty array for a missing shard.
   */
  async function load (prefix, signal) {
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
   * Converts a compact encoded row into a named record.
   *
   * @param {unknown[]} row - Encoded shard row.
   * @param {{schema: string[], sources: string[]}} manifest - Index manifest.
   * @returns {Record<string, unknown>} Decoded record without empty fields.
   */
  function decode (row, manifest) {
    return Object.fromEntries(
      manifest.schema
        .map((field, index) => [
          field,
          field === 'SOURCE' && Number.isInteger(row[index])
            ? manifest.sources[row[index]]
            : row[index]
        ])
        .filter(
          ([, value]) => value !== null && value !== undefined && value !== ''
        )
    )
  }

  /**
   * Selects a leaf shard, preview route, or no result plan for a normalized prefix.
   *
   * A leaf contains every matching row; an incomplete route requires a bounded
   * descendant traversal to provide a preview.
   *
   * @param {string} prefix - Normalized query prefix.
   * @param {Record<string, unknown>} manifest - Index manifest.
   * @returns {{kind: 'none'} | {kind: 'leaf', shard: string} | {kind: 'preview', node: string}} Search plan.
   */
  function planFor (prefix, manifest) {
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
   * Collects a bounded, deterministic preview from descendant shards of a route.
   *
   * Every visited leaf shares the query prefix, so callers only need to apply
   * source and type refinements to the returned rows.
   *
   * @param {string} node - Route node to traverse.
   * @param {Record<string, unknown>} manifest - Index manifest.
   * @param {number} previewLimit - Maximum number of encoded rows to collect.
   * @param {AbortSignal} [signal] - Signal used to cancel shard requests.
   * @returns {Promise<{rows: unknown[][], moreAvailable: boolean}>} Preview rows and availability marker.
   */
  async function gatherPreview (node, manifest, previewLimit, signal) {
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
      rows.push(...(await load(candidate, signal)))
    }
    return { rows, moreAvailable: queue.length > 0 }
  }

  return Object.freeze({
    /**
     * Searches records whose normalized names start with the supplied query.
     *
     * @param {string} query - Prefix to search.
     * @param {object} [options={}] - Per-search options.
     * @param {AbortSignal} [options.signal] - Signal used to cancel requests.
     * @param {string[]} [options.sources] - Included sources.
     * @param {string[]} [options.types] - Included types.
     * @param {number} [options.previewLimit=20] - Maximum rows gathered for an incomplete route.
     * @param {string[]} [options.sourcePriority] - Source ranking for this search.
     * @param {string[]} [options.typePriority] - Type ranking for this search.
     * @returns {Promise<Array<Record<string, unknown>> & {moreAvailable?: boolean}>} Matching records.
     */
    async search (
      query,
      {
        signal,
        sources,
        types,
        previewLimit = 20,
        sourcePriority: searchSourcePriority = sourcePriority,
        typePriority: searchTypePriority = typePriority
      } = {}
    ) {
      const prefix = normalize(query)
      const manifest = await loadManifest(signal)
      const plan = planFor(prefix, manifest)
      let rows = []
      let moreAvailable = false
      if (plan.kind === 'leaf') {
        rows = await load(plan.shard, signal)
        moreAvailable = Object.hasOwn(manifest.truncated ?? {}, plan.shard)
      } else if (plan.kind === 'preview') {
        ;({ rows, moreAvailable } = await gatherPreview(
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
          : priorityMap(searchSourcePriority)
      const typePriorities =
        searchTypePriority === typePriority
          ? defaultTypePriorities
          : priorityMap(searchTypePriority)
      const sourceFilter = sources === undefined ? undefined : new Set(sources)
      const typeFilter = types === undefined ? undefined : new Set(types)
      const results = rows
        .map(row => decode(row, manifest))
        .filter(
          record =>
            normalize(record.NAME1).startsWith(prefix) &&
            (!sourceFilter || sourceFilter.has(record.SOURCE)) &&
            (!typeFilter || typeFilter.has(record.TYPE))
        )
        .sort(compareRecords(query, sourcePriorities, typePriorities))
      return Object.assign(results, { moreAvailable })
    },
    /**
     * Retrieves the cached index manifest.
     *
     * @param {object} [options={}] - Request options.
     * @param {AbortSignal} [options.signal] - Signal used to cancel the initial request.
     * @returns {Promise<Record<string, unknown>>} Index manifest.
     */
    metadata ({ signal } = {}) {
      return loadManifest(signal)
    },
    /** Clears cached manifest and shard data. */
    clearCache () {
      cache.clear()
    }
  })
}

/** Default client configured to use the hosted Great Britain name index. */
export const nameIndex = createNameIndex()
/** Searches the hosted index with the default client. */
export const search = nameIndex.search
