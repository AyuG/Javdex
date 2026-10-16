import assert from 'node:assert/strict'
import { it } from 'node:test'
import { externalRatingLink } from './externalRatingLink'

const links = [
  { position: 0, label: 'JavDB', url: 'https://javdb.com/v/abc' },
  { position: 1, label: 'JavLibrary', url: 'https://www.javlibrary.com/cn/?v=xyz' }
]

it('opens the stored detail page belonging to each rating platform, even without a code', () => {
  assert.equal(externalRatingLink('JavLibrary', '', links), links[1].url)
  assert.equal(externalRatingLink('javDB', '', links), links[0].url)
  assert.equal(externalRatingLink('JavDB', '', links, 'https://javdb.com/v/scraped'),
    'https://javdb.com/v/scraped')
  assert.equal(externalRatingLink('JavLibrary', '', links, links[0].url), links[1].url)
})

it('falls back to an encoded code search instead of unrelated, unsafe or non-detail links', () => {
  const invalid = ['bad URL', 'javascript:alert(1)', 'https://javdb.com.evil.test/v/abc',
    'https://user:password@javdb.com/v/abc', 'https://javdb.com/search?q=OLD',
    'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=OLD']
    .map((url, position) => ({ position, label: 'JavDB', url }))
  assert.equal(externalRatingLink('JavDB', ' ABC & 123 ', invalid),
    'https://javdb.com/search?q=ABC%20%26%20123&f=all')
  assert.equal(externalRatingLink('JavLibrary', 'ABC-123', [links[0]]),
    'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=ABC-123')
})

it('leaves unsupported platforms and missing destinations as plain text', () => {
  assert.equal(externalRatingLink('Other', 'ABC-123', links), null)
  assert.equal(externalRatingLink('JavDB', '  ', []), null)
  assert.equal(externalRatingLink('JavLibrary', '', []), null)
})
