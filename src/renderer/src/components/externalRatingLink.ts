import type { RelatedLink } from '@shared/relatedLinkTypes'

/** Match the rating's platform, independently of the currently selected scraper. */
export function externalRatingLink(
  source: string, code: string, links: readonly RelatedLink[], sourceUrl?: string | null
): string | null {
  const platform = source.trim().toLowerCase()
  if (platform !== 'javlibrary' && platform !== 'javdb') return null
  const domain = platform === 'javlibrary' ? 'javlibrary.com' : 'javdb.com'
  const candidates = [sourceUrl, ...links.map(link => link.url)]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue
      if (url.hostname !== domain && url.hostname !== `www.${domain}`) continue
      const detail = platform === 'javlibrary'
        ? /^\/(?:cn|en|ja|tw)\/(?:index\.php)?$/.test(url.pathname) && !!url.searchParams.get('v')
        : /^\/v\/[^/]+\/?$/.test(url.pathname)
      if (detail) return url.toString()
    } catch {
      // Invalid or unrelated stored links do not prevent a search fallback.
    }
  }
  const keyword = code.trim()
  if (!keyword) return null
  return platform === 'javlibrary'
    ? `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodeURIComponent(keyword)}`
    : `https://javdb.com/search?q=${encodeURIComponent(keyword)}&f=all`
}
