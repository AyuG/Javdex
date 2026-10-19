import assert from 'node:assert/strict'
import { it } from 'node:test'
import React from 'react'
import { create } from 'react-test-renderer'
import VideoContentBadges from './VideoContentBadges'

Object.defineProperty(globalThis, 'React', { configurable: true, value: React })

it('shows compact independent marks with full-name tooltips in stable order', () => {
  const renderer = create(<VideoContentBadges marks={['uncensored-leaked', 'chinese-subtitles', 'uncensored-cracked', 'chinese-subtitles']} />)
  try {
    const badges = renderer.root.findAll((node) => typeof node.type === 'string' && !!node.props.title)
    assert.deepEqual(badges.map((node) => [node.children[0], node.props.title]), [
      ['中', '中文字幕'], ['破', '无码破解'], ['流', '无码流出']
    ])
    assert.equal(renderer.root.findByProps({ role: 'group' }).props['aria-label'], '影片标记：中文字幕、无码破解、无码流出')
  } finally { renderer.unmount() }
})

it('adds no empty corner decoration for unmarked films', () => {
  const renderer = create(<VideoContentBadges />)
  try { assert.equal(renderer.toJSON(), null) } finally { renderer.unmount() }
})
