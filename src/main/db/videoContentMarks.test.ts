import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDatabase, getDb, initDatabaseAtPath, openReadOnlyDatabaseAtPath } from './database'
import { insertTestVideoWithFile } from './testVideoFixtures'
import { createScopedVideoCatalogRepo } from './scopedVideoCatalogRepo'
import { videoCardSelect, hydrateVideoCardRows, type VideoCardProjectionRow } from './videoListProjection'
import { toScopedVideoCard } from '@shared/cardProjection'

let directory: string
let videoId: number
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'javdex-content-marks-'))
  const db = initDatabaseAtPath(path.join(directory, 'catalog.db'))
  videoId = insertTestVideoWithFile(db, { code: 'ABC-123', filePath: 'C:\\作品\\ABC-123-UC.mp4' }).videoId
})
afterEach(() => { closeDatabase(); fs.rmSync(directory, { recursive: true, force: true }) })

describe('video content marks in card queries', () => {
  it('combines file and tag facts without duplicating marks and refreshes after edits', () => {
    const db = getDb(), repo = createScopedVideoCatalogRepo(db), scope = { kind: 'library', libraryId: 1 } as const
    assert.deepEqual(repo.list(scope).items[0].content_marks, ['chinese-subtitles', 'uncensored-cracked'])
    assert.deepEqual(repo.get(scope, videoId)?.content_marks, repo.list(scope).items[0].content_marks)
    db.exec(`INSERT INTO tags(name) VALUES('中文字幕'),('无码流出');
      INSERT INTO video_tag(video_id,tag_id) SELECT ${videoId},id FROM tags;`)
    const card = toScopedVideoCard(repo.list(scope).items[0])
    assert.deepEqual(card.content_marks, ['chinese-subtitles', 'uncensored-cracked', 'uncensored-leaked'])
    assert.deepEqual(repo.get(scope, videoId)?.content_marks, card.content_marks)
    assert.ok(!JSON.stringify(card).includes('作品'))
    assert.ok(!('content_marks_mask' in card))
    db.prepare('DELETE FROM video_tag WHERE video_id=?').run(videoId)
    db.prepare('UPDATE video_resources SET locator=? WHERE video_id=?').run('C:\\中文字幕\\ABC-123.mp4', videoId)
    assert.equal(repo.list(scope).items[0].content_marks, undefined)
    assert.equal(repo.get(scope, videoId)?.content_marks, undefined)
  })

  it('does not borrow another library resource filename while sharing the canonical video tags', () => {
    const db = getDb(), repo = createScopedVideoCatalogRepo(db)
    db.exec(`INSERT INTO media_libraries(id,name) VALUES(2,'Second');
      INSERT INTO library_video_memberships(library_id,video_id,discovery_key) VALUES(2,${videoId},${videoId});
      INSERT INTO video_resources(library_id,video_id,kind,locator,resource_key,source_identity,is_primary)
        VALUES(2,${videoId},'local','D:\\ABC-123-L.mp4','second','second-file',1);`)
    assert.deepEqual(repo.list({ kind: 'library', libraryId: 1 }).items[0].content_marks, ['chinese-subtitles', 'uncensored-cracked'])
    assert.deepEqual(repo.list({ kind: 'library', libraryId: 2 }).items[0].content_marks, ['uncensored-leaked'])
    assert.deepEqual(repo.get({ kind: 'library', libraryId: 1 }, videoId)?.content_marks, ['chinese-subtitles', 'uncensored-cracked'])
    assert.deepEqual(repo.get({ kind: 'library', libraryId: 2 }, videoId)?.content_marks, ['uncensored-leaked'])
    db.exec(`INSERT INTO tags(name) VALUES('中文字幕'); INSERT INTO video_tag(video_id,tag_id) SELECT ${videoId},id FROM tags`)
    assert.deepEqual(repo.list({ kind: 'library', libraryId: 2 }).items[0].content_marks, ['chinese-subtitles', 'uncensored-leaked'])
    assert.deepEqual(repo.get({ kind: 'library', libraryId: 2 }, videoId)?.content_marks, ['chinese-subtitles', 'uncensored-leaked'])
  })

  it('keeps actor/playlist narrow projections and readonly readers compatible without sending names', () => {
    const reader = openReadOnlyDatabaseAtPath(path.join(directory, 'catalog.db'))
    try {
      const raw = reader.prepare(`SELECT ${videoCardSelect()} FROM videos v WHERE v.id=?`).all(videoId) as VideoCardProjectionRow[]
      assert.deepEqual(hydrateVideoCardRows(raw)[0].content_marks, ['chinese-subtitles', 'uncensored-cracked'])
      assert.ok(!JSON.stringify(raw).includes('作品'))
      assert.ok(!('content_marks_mask' in hydrateVideoCardRows(raw)[0]))
    } finally { reader.close() }
  })

  it('ignores URL tokens and uses explicit external resource display names instead', () => {
    const db = getDb(), repo = createScopedVideoCatalogRepo(db)
    db.prepare('UPDATE video_resources SET kind=?,locator=?,display_name=?,source_identity=NULL WHERE video_id=?')
      .run('web', 'https://example.test/无码破解?filename=ABC-123-C', null, videoId)
    assert.equal(repo.list({ kind: 'library', libraryId: 1 }).items[0].content_marks, undefined)
    assert.equal(repo.get({ kind: 'library', libraryId: 1 }, videoId)?.content_marks, undefined)
    db.prepare('UPDATE video_resources SET display_name=? WHERE video_id=?').run('ABC-123-LC.mp4', videoId)
    assert.deepEqual(repo.list({ kind: 'library', libraryId: 1 }).items[0].content_marks, ['chinese-subtitles', 'uncensored-leaked'])
    assert.deepEqual(repo.get({ kind: 'library', libraryId: 1 }, videoId)?.content_marks, ['chinese-subtitles', 'uncensored-leaked'])
    db.prepare('UPDATE video_resources SET strm_source_path=?,source_identity=?,display_name=NULL WHERE video_id=?')
      .run('D:\\来源\\ABC-123-UC.strm', 'strm-file', videoId)
    assert.deepEqual(repo.list({ kind: 'library', libraryId: 1 }).items[0].content_marks, ['chinese-subtitles', 'uncensored-cracked'])
    assert.deepEqual(repo.get({ kind: 'library', libraryId: 1 }, videoId)?.content_marks, ['chinese-subtitles', 'uncensored-cracked'])
  })
})
