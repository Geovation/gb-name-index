/**
 * Converts a machine-readable identifier to a space-separated display label.
 *
 * @param {string} label - Identifier to format.
 * @returns {string} Display label.
 */
export function formatLabel (label) {
  return label ? label.replaceAll('_', ' ') : label
}

/**
 * Resolves a source-specific type label, with a readable fallback.
 *
 * @param {string} source - Record source name.
 * @param {string} type - Source type identifier.
 * @param {Record<string, Record<string, string>>} [typeLabelsBySource={}] - Source label mappings.
 * @returns {string} Display label for the type.
 */
export function typeLabel (source, type, typeLabelsBySource = {}) {
  if (!type) return type
  return typeLabelsBySource[source]?.[type] ?? formatLabel(type)
}

/**
 * Formats a record's coordinates for display when both values are finite.
 *
 * @param {{LATITUDE?: number, LONGITUDE?: number}} record - Place record.
 * @returns {string} Coordinate label, or an empty string when unavailable.
 */
export function coordinateLabel (record) {
  if (!Number.isFinite(record.LATITUDE) || !Number.isFinite(record.LONGITUDE))
    return ''
  return `${record.LATITUDE.toFixed(5)}, ${record.LONGITUDE.toFixed(5)}`
}

/**
 * Produces contextual metadata to distinguish a result from similarly named places.
 *
 * @param {Record<string, string | number | undefined>} record - Result record.
 * @param {Record<string, string[]>} typesBySource - Types indexed by source.
 * @param {Record<string, Record<string, string>>} typeLabelsBySource - Type labels indexed by source.
 * @param {Map<string, number>} resultNameCounts - Count for each normalized result name.
 * @param {Map<string, number>} resultContextCounts - Count for each result context.
 * @returns {string} Human-readable result metadata.
 */
export function resultMeta (
  record,
  typesBySource,
  typeLabelsBySource,
  resultNameCounts,
  resultContextCounts
) {
  const context = [
    record.NAME1,
    record.LOCALITY,
    record.POSTCODE_DISTRICT,
    record.REGION
  ]
    .join('|')
    .toLowerCase()
  const needsCoordinates =
    resultNameCounts.get(record.NAME1.toLowerCase()) > 1 &&
    resultContextCounts.get(context) > 1
  return [
    record.LOCAL_TYPE ||
      typeLabel(record.SOURCE, record.TYPE, typeLabelsBySource),
    record.LOCALITY,
    record.POSTCODE_DISTRICT,
    record.REGION,
    needsCoordinates && coordinateLabel(record),
    record.SOURCE
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Adds or removes a value from a list without mutating the original list.
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
 * Moves a list item by one position without mutating the original list.
 *
 * @template T
 * @param {T[]} list - Existing values.
 * @param {number} index - Index of the value to move.
 * @param {number} direction - Position offset, normally -1 or 1.
 * @returns {T[]} Reordered list, or the original list when the move is out of bounds.
 */
export function move (list, index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= list.length) return list
  const next = [...list]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  return next
}
