/**
 * Turns identifiers such as `historic_site` into labels people can scan.
 *
 * @param {string} label - Identifier to format.
 * @returns {string} Display label.
 */
export function formatLabel (label) {
  return label ? label.replaceAll('_', ' ') : label
}

/**
 * Uses the source's preferred category wording, or formats the category when
 * the manifest does not contain a label for it.
 *
 * @param {string} source - Record source name.
 * @param {string} category - Category identifier.
 * @param {Record<string, Record<string, string>>} [categoryLabelsBySource={}] - Source label mappings.
 * @returns {string} Display label for the category.
 */
export function categoryLabel (source, category, categoryLabelsBySource = {}) {
  if (!category) return category
  return categoryLabelsBySource[source]?.[category] ?? formatLabel(category)
}

/**
 * Labels a selected category using the first selected source with a published label.
 *
 * @param {string} category - Category identifier to display.
 * @param {string[]} selectedSources - Sources currently included in the search.
 * @param {Record<string, string[]>} categoriesBySource - Categories available from each source.
 * @param {Record<string, Record<string, string>>} categoryLabelsBySource - Source-specific display labels.
 * @returns {string} Readable label for the selected category.
 */
export function selectedCategoryLabel (
  category,
  selectedSources,
  categoriesBySource,
  categoryLabelsBySource = {}
) {
  const sourceWithLabel = selectedSources.find(source =>
    categoriesBySource[source]?.includes(category) &&
    categoryLabelsBySource[source]?.[category]
  )
  const sourceWithCategory = selectedSources.find(source =>
    categoriesBySource[source]?.includes(category)
  )
  const source = sourceWithLabel ?? sourceWithCategory
  return source
    ? categoryLabel(source, category, categoryLabelsBySource)
    : formatLabel(category)
}

/**
 * Makes a coordinate pair readable for the selected-place details.
 *
 * @param {{latitude?: number, longitude?: number}} record - Place record.
 * @returns {string} Coordinate label, or an empty string when unavailable.
 */
export function coordinateLabel (record) {
  if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude))
    return ''
  return `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`
}

/**
 * Builds the short line shown under a result name so repeated names are easier
 * to tell apart. Coordinates are added when the other context is still shared.
 *
 * @param {Record<string, string | number | undefined>} record - Result record.
 * @param {Record<string, Record<string, string>>} categoryLabelsBySource - Category labels indexed by source.
 * @param {Map<string, number>} resultNameCounts - Count for each normalized result name.
 * @param {Map<string, number>} resultContextCounts - Count for each result context.
 * @returns {string} Human-readable result metadata.
 */
export function resultMeta (
  record,
  categoryLabelsBySource,
  resultNameCounts,
  resultContextCounts
) {
  const context = [
    record.name,
    record.locality,
    record.postcodeDistrict,
    record.region
  ]
    .join('|')
    .toLowerCase()
  const needsCoordinates =
    resultNameCounts.get(record.name.toLowerCase()) > 1 &&
    resultContextCounts.get(context) > 1
  return [
    record.subtype ||
      categoryLabel(record.source, record.category, categoryLabelsBySource),
    record.locality,
    record.postcodeDistrict,
    record.region,
    needsCoordinates && coordinateLabel(record),
    record.source
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Toggles a selected filter without mutating the list held in Svelte state.
 *
 * @template T
 * @param {T[]} list - Existing values.
 * @param {T} value - Value to toggle.
 * @returns {T[]} Updated value list.
 */
export function toggle (list, value) {
  return list.includes(value)
    ? list.filter(item => item !== value)
    : [...list, value]
}

/**
 * Changes a source or type's ranking position without mutating its current list.
 *
 * @template T
 * @param {T[]} list - Existing values.
 * @param {number} index - Index of the value to move.
 * @param {number} direction - Use `-1` to move up or `1` to move down.
 * @returns {T[]} Reordered list, or the original list if the item is already at that edge.
 */
export function move (list, index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= list.length) return list
  const next = [...list]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  return next
}
