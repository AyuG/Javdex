import type Database from 'better-sqlite3'
import { videoContentMaskFromResource, videoContentMaskFromLabel } from '@shared/videoContentMarks'

const registered = new WeakSet<Database.Database>()

/** Writer, readonly catalog reader and injected repository connections share the same rules. */
export function registerVideoContentMarkFunctions(database: Database.Database): void {
  if (registered.has(database)) return
  database.function('video_filename_mark_mask', { deterministic: true }, videoContentMaskFromResource)
  database.function('video_tag_mark_mask', { deterministic: true }, videoContentMaskFromLabel)
  database.aggregate<number>('video_mark_union', {
    start: 0,
    step: (total: number, next: unknown) => total | (typeof next === 'number' ? next : 0)
  })
  registered.add(database)
}

/** Return three bits, never filenames or full tag arrays, from the current card page. */
export function videoContentMarksSelect(videoAlias = 'v', resourcePredicate?: string): string {
  const resourceScope = resourcePredicate ?? `EXISTS (
    SELECT 1 FROM library_video_memberships mark_membership
    JOIN media_libraries mark_library ON mark_library.id = mark_membership.library_id
    WHERE mark_membership.video_id = ${videoAlias}.id
      AND mark_membership.library_id = mark_resource.library_id
      AND mark_membership.is_hidden = 0 AND mark_library.status = 'active'
  )`
  return `(COALESCE((
    SELECT video_mark_union(video_filename_mark_mask(
      mark_resource.kind, mark_resource.locator, mark_resource.display_name, mark_resource.strm_source_path, ${videoAlias}.code))
    FROM video_resources mark_resource
    WHERE mark_resource.video_id = ${videoAlias}.id AND ${resourceScope}
  ), 0) | COALESCE((
    SELECT video_mark_union(video_tag_mark_mask(mark_tag.name))
    FROM video_tag mark_link JOIN tags mark_tag ON mark_tag.id = mark_link.tag_id
    WHERE mark_link.video_id = ${videoAlias}.id
  ), 0)) AS content_marks_mask`
}
