import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { videoContentMaskFromFilename, videoContentMaskFromLabel, videoContentMarksFromMask } from './videoContentMarks'

describe('video content mark recognition', () => {
  it('recognizes the agreed filename suffixes and combines independent marks', () => {
    for (const [suffix, mask] of Object.entries({ C: 1, U: 2, UC: 3, L: 4, LC: 5, 'U-C-L': 7 })) {
      assert.equal(videoContentMaskFromFilename(`C:\\作品\\ABC-123-${suffix}.mp4`, 'ABC-123'), mask)
      assert.equal(videoContentMaskFromFilename(`abc_123_${suffix.toLowerCase()} 1080p.mkv`, 'ABC-123'), mask)
    }
    assert.equal(videoContentMaskFromFilename('FC2-PPV-123456-LC.mp4', 'FC2-PPV-123456'), 5)
    assert.equal(videoContentMaskFromFilename('ABC-123-UC-CD1.mp4', 'ABC-123'), 3)
    assert.equal(videoContentMaskFromFilename('ABC-123-C 无码流出.mp4', 'ABC-123'), 5)
  })

  it('reads explicit Chinese tags and filename descriptions, including traditional labels', () => {
    assert.equal(videoContentMaskFromLabel('中文字幕'), 1)
    assert.equal(videoContentMaskFromLabel('无码破解'), 2)
    assert.equal(videoContentMaskFromLabel('無碼流出'), 4)
    assert.equal(videoContentMaskFromLabel('中字／無碼破解／无码流出'), 7)
    assert.equal(videoContentMaskFromFilename('ABC-123【中文字幕】【无码破解】.mp4', 'ABC-123'), 3)
  })

  it('does not infer marks from folders, other codes, disc numbers, ordinary uncensored or subtitle labels', () => {
    for (const filename of [
      '/中文字幕/无码破解/ABC-123.mp4', 'ABC-1234-C.mp4', 'ABC-123-CD1.mp4',
      'ABC-123-1080p-C.mp4', 'ABC-123-UNCENSORED.mp4', 'ABC-123 日文字幕.mp4'
    ]) assert.equal(videoContentMaskFromFilename(filename, 'ABC-123'), 0, filename)
    for (const label of ['无码', '字幕', '无中文字幕', '未破解', '非无码流出', 'C', 'UC', null]) {
      assert.equal(videoContentMaskFromLabel(label), 0, String(label))
    }
    assert.equal(videoContentMaskFromFilename(null, 'ABC-123'), 0)
  })

  it('uses stable deduplicated display order', () => {
    assert.deepEqual(videoContentMarksFromMask(7), ['chinese-subtitles', 'uncensored-cracked', 'uncensored-leaked'])
    assert.deepEqual(videoContentMarksFromMask(undefined), [])
    assert.deepEqual(videoContentMarksFromMask(1.5), [])
  })
})
