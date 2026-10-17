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
        for (const accent of [base['--accent'], '#000000', '#ffffff', '#ffff00', '#ff0000', '#777777']) {
          const tokens = accentTokens(accent, base['--bg-1'], dark)
          assert.ok(contrastRatio(tokens['--text-on-accent'], accent) >= 4.5, `${palette} button ${accent}`)
          assert.ok(contrastRatio(tokens['--text-on-accent'], tokens['--accent-hover']) >= 4.5, `${palette} hover ${accent}`)
          assert.ok(contrastRatio(tokens['--text-accent'], base['--bg-1']) >= 4.5, `${palette} link ${accent}`)
        }
      }
    }
  })
})
