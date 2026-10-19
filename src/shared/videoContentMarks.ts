export const VIDEO_CONTENT_MARKS = [
  { id: 'chinese-subtitles', shortLabel: '中', label: '中文字幕', mask: 1 },
  { id: 'uncensored-cracked', shortLabel: '破', label: '无码破解', mask: 2 },
  { id: 'uncensored-leaked', shortLabel: '流', label: '无码流出', mask: 4 }
] as const

export type VideoContentMark = (typeof VIDEO_CONTENT_MARKS)[number]['id']

const SUFFIX_MASKS: Record<string, number> = { C: 1, U: 2, UC: 3, L: 4, LC: 5 }

/** Explicit labels only: "字幕" and "无码" alone do not establish these facts. */
export function videoContentMaskFromLabel(value: unknown): number {
  if (typeof value !== 'string') return 0
  const label = value.normalize('NFKC').replace(
    /(?:不含|不带|不帶|没有|沒有|未带|未帶|非|未|无|無)(?:中文字幕|中文硬字幕|中文内嵌字幕|中文內嵌字幕|中字|无码破解|無碼破解|破解|无码流出|無碼流出|流出)/g,
    ''
  )
  let mask = 0
  if (/中文字幕|中文硬字幕|中文内嵌字幕|中文內嵌字幕|中字/.test(label)) mask |= 1
  if (/破解/.test(label)) mask |= 2
  if (/流出/.test(label)) mask |= 4
  return mask
}

/** Read only the basename, and interpret letter markers immediately after this video's code. */
export function videoContentMaskFromFilename(value: unknown, code: unknown): number {
  if (typeof value !== 'string') return 0
  const filename = (value.split(/[\\/]/).pop() ?? '').normalize('NFKC')
  let mask = videoContentMaskFromLabel(filename)
  if (typeof code !== 'string' || !code.trim()) return mask
  const escapedCode = code.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-_\\s]?')
  const match = new RegExp(`(?:^|[^a-z0-9])${escapedCode}(?=$|[-_.\\s])`, 'i').exec(filename)
  if (!match) return mask
  const tail = filename.slice(match.index + match[0].length).replace(/\.[a-z\d]{2,5}$/i, '')
  for (const token of tail.split(/[-_.\s[\]()【】（）]+/).filter(Boolean)) {
    const suffix = SUFFIX_MASKS[token.toUpperCase()]
    if (suffix === undefined) break
    mask |= suffix
  }
  return mask
}

export function videoContentMarksFromMask(value: unknown): VideoContentMark[] {
  const mask = typeof value === 'number' && Number.isSafeInteger(value) ? value : 0
  return VIDEO_CONTENT_MARKS.filter((mark) => (mask & mark.mask) !== 0).map((mark) => mark.id)
}

/** Both card queries and scoped detail reads use the actual filename, never URL tokens. */
export function videoContentMaskFromResource(
  kind: unknown,
  locator: unknown,
  displayName: unknown,
  strmSourcePath: unknown,
  code: unknown
): number {
  return videoContentMaskFromFilename(kind === 'local' ? locator : strmSourcePath || displayName, code)
}
