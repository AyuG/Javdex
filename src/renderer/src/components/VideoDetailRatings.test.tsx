import assert from 'node:assert/strict'
import { it } from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import type { VideoDetail } from '@shared/videoTypes'
import VideoDetailRatings from './VideoDetailRatings'
import { LOCAL_NFO_SOURCE_ID, LOCAL_NFO_SOURCE_NAME } from '@shared/videoMetadataSourceConstants'

Object.defineProperty(globalThis, 'React', { configurable: true, value: React })

it('links only supported platform names and delegates clicks to the default browser API', async () => {
  const opened: string[] = []
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    api: { externalLinks: { open: async (url: string) => { opened.push(url); return true } } }
  } })
  const video = {
    code: 'ABC-123', rating: 3,
    links: [{ position: 0, label: 'JavLibrary', url: 'https://www.javlibrary.com/cn/?v=abc' }],
    external_stats: ['JavLibrary', 'JavDB', 'Other', 'Unrated'].map((source, id) => ({
      id, video_id: 1, source, rating_average: source === 'Unrated' ? null : 8.5,
      rating_count: 1234, fetched_at: null
    }))
  } as VideoDetail
  let renderer: TestRenderer.ReactTestRenderer | undefined
  try {
    await act(async () => { renderer = TestRenderer.create(<VideoDetailRatings video={video} onRatingChange={() => {}} />) })
    const anchors = renderer!.root.findAllByType('a')
    assert.deepEqual(anchors.map(a => a.children), [['JavLibrary'], ['JavDB']])
    let prevented = 0
    await act(async () => {
      for (const anchor of anchors) anchor.props.onClick({ preventDefault: () => { prevented++ } })
    })
    assert.equal(prevented, 2)
    assert.deepEqual(opened, ['https://www.javlibrary.com/cn/?v=abc', 'https://javdb.com/search?q=ABC-123&f=all'])
    const text = JSON.stringify(renderer!.toJSON())
    assert.match(text, /Other/)
    assert.match(text, /1,234 人/)
    assert.doesNotMatch(text, /Unrated/)
  } finally {
    await act(async () => { renderer?.unmount() })
  }
})

for (const source of [LOCAL_NFO_SOURCE_ID, LOCAL_NFO_SOURCE_NAME]) {
  it(`separates ${source} from external platforms and preserves the full local label`, async () => {
    const video = { code: 'ABC-123', rating: 3, links: [], external_stats: [
      { id: 1, source: 'JavLibrary', rating_average: 3.9, rating_count: 12345 },
      { id: 2, source, rating_average: 3.8, rating_count: null }
    ] } as unknown as VideoDetail
    let renderer: TestRenderer.ReactTestRenderer | undefined
    try {
      await act(async () => { renderer = TestRenderer.create(<VideoDetailRatings video={video} onRatingChange={() => {}} />) })
      assert.deepEqual(renderer!.root.findAllByType('dt').map(n => n.children.join('')),
        ['自定义评分', '外部评分', LOCAL_NFO_SOURCE_NAME])
      assert.equal(renderer!.root.findAllByType('a').length, 1)
      const count = renderer!.root.findByProps({ 'aria-label': '12,345 人评分' })
      assert.equal(count.children.join(''), '· 1.2万人')
      assert.equal(count.props.title, '12,345 人评分')
    } finally { await act(async () => { renderer?.unmount() }) }
  })
}

it('keeps custom rating editable and hides absent sources and unknown or invalid counts', async () => {
  const changed: number[] = []
  const video = { code: 'ABC-123', rating: 3, links: [], external_stats: [] } as unknown as VideoDetail
  let renderer: TestRenderer.ReactTestRenderer | undefined
  try {
    await act(async () => { renderer = TestRenderer.create(<VideoDetailRatings video={video} onRatingChange={n => changed.push(n)} />) })
    assert.deepEqual(renderer!.root.findAllByType('dt').map(n => n.children.join('')), ['自定义评分'])
    await act(async () => { renderer!.root.findAllByType('button')[4].props.onClick({ stopPropagation: () => {} }) })
    assert.deepEqual(changed, [5])
    for (const count of [null, 0, -1, 1.5, NaN, Infinity]) {
      video.external_stats = [{ id: 1, video_id: 1, source: 'Other', rating_average: 4, rating_count: count, fetched_at: null }]
      await act(async () => { renderer!.update(<VideoDetailRatings video={video} onRatingChange={() => {}} />) })
      assert.equal(renderer!.root.findAll(n => typeof n.props['aria-label'] === 'string' && n.props['aria-label'].endsWith('人评分')).length, 0)
    }
  } finally { await act(async () => { renderer?.unmount() }) }
})
