import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { it } from 'node:test'
import * as cheerio from 'cheerio'

const require = createRequire(import.meta.url)
const library = require(path.resolve('src/main/bundled-plugins/video/JavLibrary/index.cjs'))
const javdb = require(path.resolve('src/main/bundled-plugins/video/JavDB/index.cjs'))

async function libraryResult(countHtml: string) {
  return library.parseVideo({ code: 'ABC-123', cheerio, fetchPage: async () => `
    <div id="video_info"></div><div id="video_id"><span class="text">ABC-123</span></div>
    <div id="video_title"><a><span class="post-title text">ABC-123 Test</span></a></div>
    <div id="video_review"><span class="score">(7.8)</span>${countHtml}</div>` })
}

it('JavLibrary extracts explicit vote counts without changing its five-point score', async () => {
  for (const markup of ['<span>1,234 人评分</span>', '<span>1，234 人評價</span>',
    '<span>1,234 votes</span>', '<meta itemprop="ratingCount" content="1234">']) {
    const result = await libraryResult(markup)
    assert.equal(result[0].ratingCount, 1234)
    assert.equal(result[0].ratingAverage, 3.9)
  }
})

it('JavLibrary leaves missing votes unknown instead of using review/comment counts', async () => {
  for (const markup of ['', '<span>1234 条评论</span>', '<span>0 人评分</span>']) {
    const result = await libraryResult(markup)
    assert.equal(result[0].ratingCount, null)
  }
})

it('JavDB reads counts with whitespace and thousands separators and preserves missing counts', async () => {
  for (const [text, expected] of [['4.1分, 由 1,234 人評價', 1234],
    ['4.1分, 由1，234人评价', 1234], ['4.1分, 由1234人評價', 1234], ['4.1分', null]] as const) {
    const result = await javdb.parseVideo({ code: 'ABC-123', cheerio, fetchPage: async (url: string) =>
      url.includes('/search?')
        ? '<div class="movie-list"><div class="item"><a class="box" href="/v/test"></a><div class="video-title"><strong>ABC-123</strong></div></div></div>'
        : `<div class="video-detail"><h2 class="title"><span class="current-title">Test</span></h2>
          <div class="panel-block"><strong>番號:</strong><span class="value">ABC-123</span></div>
          <div class="panel-block"><strong>評分:</strong><span class="value">${text}</span></div></div>` })
    assert.equal(result[0].ratingCount, expected)
    assert.equal(result[0].ratingAverage, 4.1)
  }
})
