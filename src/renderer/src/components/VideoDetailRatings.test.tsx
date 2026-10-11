import assert from 'node:assert/strict'
import { it } from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import type { VideoDetail } from '@shared/videoTypes'
import VideoDetailRatings from './VideoDetailRatings'

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
