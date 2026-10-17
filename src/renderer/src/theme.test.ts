import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_APPEARANCE, normalizeAppearance, THEME_PALETTES } from '@shared/appearance'
import { accentTokens, contrastRatio, paletteTokens, resolveTheme } from './theme'

describe('appearance migration and colors', () => {
  it('retains brightness and palette from each legacy theme', () => {
    for (const theme of ['graphite', 'warm', 'slate', 'light']) {
      const preferences = normalizeAppearance(undefined, theme)
      assert.equal(resolveTheme(preferences, true), theme)
    }
    assert.deepEqual(normalizeAppearance({ mode: 'invalid', palette: 'invalid', customAccentEnabled: 'true', customAccentColor: 'red' }), DEFAULT_APPEARANCE)
    assert.equal(normalizeAppearance({ customAccentColor: '#AABBCC' }).customAccentColor, '#aabbcc')
  })

  it('follows system changes only when system mode is selected', () => {
    assert.equal(resolveTheme({ ...DEFAULT_APPEARANCE, mode: 'system' }, false), 'light')
    assert.equal(resolveTheme({ ...DEFAULT_APPEARANCE, mode: 'system' }, true), 'graphite')
    assert.equal(resolveTheme(DEFAULT_APPEARANCE, false), 'graphite')
    assert.equal(resolveTheme({ ...DEFAULT_APPEARANCE, mode: 'light' }, true), 'light')
  })

  it('keeps text readable for all palettes and extreme custom colors in both modes', () => {
    for (const palette of THEME_PALETTES) {
      for (const dark of [true, false]) {
        const base = paletteTokens(palette, dark)
        for (const text of ['--text-0', '--text-1', '--text-2']) {
          for (const surface of ['--bg-0', '--bg-1', '--bg-2', '--bg-3']) {
            assert.ok(contrastRatio(base[text], base[surface]) >= 4.5, `${palette} ${text} on ${surface}`)
          }
        }
        for (const accent of [base['--accent'], '#000000', '#ffffff', '#ffff00', '#ff0000', '#777777']) {
          const tokens = accentTokens(accent, base['--bg-1'], dark)
          assert.ok(contrastRatio(tokens['--text-on-accent'], accent) >= 4.5, `${palette} button ${accent}`)
          assert.ok(contrastRatio(tokens['--text-on-accent'], tokens['--accent-hover']) >= 4.5, `${palette} hover ${accent}`)
          assert.ok(contrastRatio(tokens['--text-accent'], base['--bg-1']) >= 4.5, `${palette} link ${accent}`)
        }
      }
    }
  })

  it('keeps background palettes distinct in both modes without relying on their accents', () => {
    for (const dark of [false, true]) {
      for (let i = 0; i < THEME_PALETTES.length; i++) {
        const a = paletteTokens(THEME_PALETTES[i], dark)
        for (const bId of THEME_PALETTES.slice(i + 1)) {
          const b = paletteTokens(bId, dark)
          const difference = Math.hypot(...[1, 3, 5].map((start) =>
            parseInt(a['--bg-0'].slice(start, start + 2), 16) - parseInt(b['--bg-0'].slice(start, start + 2), 16)))
          assert.ok(difference >= 14, `${THEME_PALETTES[i]} and ${bId} are too similar in ${dark ? 'dark' : 'light'} mode`)
          assert.notEqual(a['--bg-1'], b['--bg-1'])
          assert.notEqual(a['--border'], b['--border'])
        }
      }
    }
  })
})
