import { resolveMediaLibraryDefaultScraper, type CatalogScope } from '@shared/mediaLibraryTypes'
import { LOCAL_NFO_SOURCE_ID, LOCAL_NFO_SOURCE_NAME } from '@shared/videoMetadataSourceConstants'
import { getMediaLibraryConfig } from '../db/mediaLibraryRepo'
import { getSettings } from '../settings/settingsStore'
import { resolveVideoScrapeFieldSources } from '../scrapers/scraperManager'

/** Resolve on the main process for every query; workers never load scraper plugins/settings. */
export function resolveExternalRatingSource(scope: CatalogScope): string | null {
  const libraryDefault = scope.kind === 'library'
    ? getMediaLibraryConfig(scope.libraryId)?.defaultVideoScraper : null
  const effective = resolveMediaLibraryDefaultScraper(libraryDefault, getSettings().defaultScraper)
  if (isLocalNfo(effective)) return null
  // Reuse the write path's authoritative plugin/composite rating source mapping.
  const source = resolveVideoScrapeFieldSources(effective).ratingSourceName
  return isLocalNfo(source) ? null : source
}

function isLocalNfo(source: string): boolean {
  return source === LOCAL_NFO_SOURCE_ID || source === LOCAL_NFO_SOURCE_NAME
}
