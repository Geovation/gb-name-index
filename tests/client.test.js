import assert from 'node:assert/strict'
import test from 'node:test'
import { createNameIndex, dataAttribution, normalize } from '../src/index.js'
import { selectedCategoryLabel } from '../web/src/lib/utils.js'

function response (body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json () {
      return body
    }
  }
}

function createFetcher (manifest, shards = {}) {
  const requests = []
  const fetcher = async url => {
    requests.push(url)
    if (url.endsWith('/index.json')) return response(manifest)
    const shard = decodeURIComponent(url.split('/').at(-1).replace(/\.json$/, ''))
    return Object.hasOwn(shards, shard)
      ? response(shards[shard])
      : response(null, 404)
  }
  return { fetcher, requests }
}

const schema = ['name', 'category', 'subtype', 'locality', 'postcodeDistrict', 'region', 'longitude', 'latitude', 'bbox', 'source']
const sources = ['OS Open Names', 'Overture Places']
const dictionaries = {
  categories: ['landform', 'park', 'populatedPlace', 'transportNetwork'],
  subtypes: ['Road'],
  localities: ['Baker Town'],
  postcodeDistricts: [],
  regions: ['Test Region'],
  sources
}

test('normalizes names to lowercase alphanumeric search keys', () => {
  assert.equal(normalize("St John's"), 'stjohns')
  assert.equal(normalize(null), '')
})

test('labels selected categories from their active sources', () => {
  const sources = ['OS Open Names', 'Overture Places']
  const categoriesBySource = {
    'OS Open Names': ['park'],
    'Overture Places': ['park', 'historic_site']
  }
  const labelsBySource = {
    'Overture Places': { park: 'Parks and recreation', historic_site: 'Historic site' }
  }

  assert.equal(
    selectedCategoryLabel('park', sources, categoriesBySource, labelsBySource),
    'Parks and recreation'
  )
  assert.equal(
    selectedCategoryLabel('historic_site', sources, categoriesBySource, labelsBySource),
    'Historic site'
  )
  assert.equal(
    selectedCategoryLabel('unmapped_type', sources, categoriesBySource),
    'unmapped type'
  )
})

test('routes prefix searches and ranks exact names before configured sources', async () => {
  const { fetcher, requests } = createFetcher(
    { ...dictionaries, schema, sources, minimumQueryLength: 3, routes: {}, truncated: {} },
    {
      bak: [
        ['Baker Street', 3, 0, 0, null, 0, null, null, null, 0],
        ['Baker Street', 1, null, 0, null, 0, null, null, [-0.1, 51.4, -0.099, 51.401], 1],
        ['Baker', 2, null, 0, null, 0, null, null, null, 0]
      ]
    }
  )
  const client = createNameIndex({ baseUrl: 'https://example.test/data/', fetch: fetcher })

  const results = await client.search('bak')

  assert.deepEqual(results.map(record => record.name), ['Baker', 'Baker Street', 'Baker Street'])
  assert.deepEqual(Object.keys(results[0]), ['name', 'category', 'locality', 'region', 'source'])
  assert.equal(results[1].source, 'OS Open Names')
  assert.deepEqual(results[2].bbox, [-0.1, 51.4, -0.099, 51.401])
  assert.equal(requests.length, 2)
  assert.equal(requests[1], 'https://example.test/data/bak.json')
})

test('applies source and category filters and reports truncated shards', async () => {
  const { fetcher } = createFetcher(
    {
      schema,
      ...dictionaries,
      minimumQueryLength: 3,
      routes: {},
      truncated: { bak: 51 }
    },
    { bak: [
      ['Baker Park', 1, null, 0, null, 0, null, null, null, 1],
      ['Baker Hill', 0, null, 0, null, 0, null, null, null, 0]
    ] }
  )
  const client = createNameIndex({ fetch: fetcher })

  const results = await client.search('bake', {
    sources: ['Overture Places'],
    categories: ['park']
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].name, 'Baker Park')
  assert.equal(results[0].category, 'park')
  assert.equal(results.moreAvailable, true)
})

test('collects a bounded preview from a routed prefix', async () => {
  const { fetcher } = createFetcher(
    {
      schema,
      ...dictionaries,
      minimumQueryLength: 3,
      routes: { bak: 'er' },
      truncated: {}
    },
    {
      bake: [['Baker Street', 3, 0, 0, null, 0, null, null, null, 0]],
      bakr: [['Bakery Lane', 3, 0, 0, null, 0, null, null, null, 0]]
    }
  )
  const client = createNameIndex({ fetch: fetcher })

  const results = await client.search('bak', { previewLimit: 1 })

  assert.equal(results.length, 1)
  assert.equal(results.moreAvailable, true)
})

test('exports source attribution and avoids shard requests for short queries', async () => {
  const { fetcher, requests } = createFetcher({ ...dictionaries, schema, minimumQueryLength: 3, routes: {} })
  const client = createNameIndex({ fetch: fetcher })

  const results = await client.search('ba')

  assert.equal(results.length, 0)
  assert.equal(requests.length, 1)
  assert.match(dataAttribution.osOpenNames, /Crown copyright.*Ordnance Survey \d{4}/)
  assert.match(dataAttribution.overtureAttribution, /overturemaps\.org/)
  assert.match(dataAttribution.overtureLicense, /Apache-2\.0/)
})

test('clearCache causes the manifest to be fetched again', async () => {
  const { fetcher, requests } = createFetcher({
    ...dictionaries,
    schema,
    minimumQueryLength: 3,
    routes: {}
  })
  const client = createNameIndex({ fetch: fetcher })

  await client.metadata()
  client.clearCache()
  await client.metadata()

  assert.equal(requests.filter(url => url.endsWith('/index.json')).length, 2)
})