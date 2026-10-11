import { afterEach, beforeEach, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDatabase, initDatabaseAtPath } from '../db/database'
import { getMediaLibraryConfig, updateMediaLibraryConfig } from '../db/mediaLibraryRepo'
import { resetSettingsCacheForTests, updateSettings } from '../settings/settingsStore'
import { createCompositeScraper } from '../scrapers/scraperPluginService'
import { LOCAL_NFO_SOURCE_ID, LOCAL_NFO_SOURCE_NAME } from '@shared/videoMetadataSourceConstants'
import { resolveExternalRatingSource } from './externalRatingSource'

let root: string, previous: string | undefined
const scope = { kind: 'library', libraryId: 1 } as const
beforeEach(() => {
  previous = process.env.JAVDEX_TEST_USER_DATA
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'javdex-external-source-'))
  process.env.JAVDEX_TEST_USER_DATA = root
  resetSettingsCacheForTests()
  initDatabaseAtPath(path.join(root, 'fixture.db'))
})
afterEach(() => {
  closeDatabase(); resetSettingsCacheForTests()
  if (previous === undefined) delete process.env.JAVDEX_TEST_USER_DATA
  else process.env.JAVDEX_TEST_USER_DATA = previous
  fs.rmSync(root, { recursive: true, force: true })
})
function override(defaultVideoScraper: string | null) {
  updateMediaLibraryConfig({ libraryId: 1, expectedRevision: getMediaLibraryConfig(1)!.revision,
    patch: { defaultVideoScraper } })
}
it('uses actual plugin identities, switches override sources and follows current global fallback', () => {
  updateSettings({ defaultScraper: 'JavDB' })
  override('JavLibrary')
  assert.equal(resolveExternalRatingSource(scope), 'JavLibrary')
  override('JavDB')
  assert.equal(resolveExternalRatingSource(scope), 'JavDB')
  override(null)
  assert.equal(resolveExternalRatingSource(scope), 'JavDB')
  updateSettings({ defaultScraper: 'JavLibrary' })
  assert.equal(resolveExternalRatingSource(scope), 'JavLibrary')
  assert.equal(resolveExternalRatingSource({ kind: 'all' }), 'JavLibrary')
})
it('excludes the authoritative Local NFO ID and name for library, global and composite rating sources', () => {
  updateSettings({ defaultScraper: 'JavDB' })
  for (const nfo of [LOCAL_NFO_SOURCE_ID, LOCAL_NFO_SOURCE_NAME]) {
    override(nfo)
    assert.equal(resolveExternalRatingSource(scope), null)
    override(null)
    updateSettings({ defaultScraper: nfo })
    assert.equal(resolveExternalRatingSource(scope), null)
  }
  createCompositeScraper('video', { name: 'Mixed network', fieldPluginMap: { title: 'JavDB', rating: 'JavLibrary' } })
  override('Mixed network')
  assert.equal(resolveExternalRatingSource(scope), 'JavLibrary')
  createCompositeScraper('video', { name: 'Mixed NFO', fieldPluginMap: { title: 'JavDB', rating: LOCAL_NFO_SOURCE_NAME } })
  override('Mixed NFO')
  assert.equal(resolveExternalRatingSource(scope), null)
})
