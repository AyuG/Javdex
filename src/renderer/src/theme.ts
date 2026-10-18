import type { ThemeId } from '@shared/settingsTypes'
import type { AppearanceSettings, ThemePalette } from '@shared/appearance'

export const PALETTE_OPTIONS: { id: ThemePalette; label: string; hint: string; accent: string; lightAccent: string }[] = [
  { id: 'graphite', label: '石墨', hint: '中性灰 · 经典蓝', accent: '#5a8fc8', lightAccent: '#3f6fb5' },
  { id: 'warm', label: '暖灰', hint: '暖砂底色 · 柔金', accent: '#d3b67c', lightAccent: '#8b632b' },
  { id: 'slate', label: '青灰', hint: '雾青底色 · 青玉', accent: '#72c8bf', lightAccent: '#187c78' },
  { id: 'forest', label: '苔绿', hint: '松林底色 · 嫩绿', accent: '#9dc782', lightAccent: '#4c752c' },
  { id: 'rose', label: '烟玫', hint: '蔷薇底色 · 玫红', accent: '#e6a0b8', lightAccent: '#ac4d70' },
  { id: 'violet', label: '暮紫', hint: '鸢尾底色 · 薰紫', accent: '#bba6f0', lightAccent: '#7855b3' },
  { id: 'ocean', label: '深海', hint: '海蓝底色 · 天蓝', accent: '#7fb8ee', lightAccent: '#226fa8' },
  { id: 'amber', label: '琥珀', hint: '琥珀底色 · 暖橙', accent: '#edb46b', lightAccent: '#a0641c' }
]

// Each mode has a complete scale: base, panel, raised, active, border,
// primary text, secondary text, muted text. Accent overrides never replace it.
type PaletteScale = readonly [string, string, string, string, string, string, string, string]
const PALETTE_SCALES: Record<ThemePalette, { dark: PaletteScale; light: PaletteScale }> = {
  graphite: {
    dark: ['#101113', '#17191c', '#202329', '#2b3038', '#363c46', '#f0f2f5', '#abb3bf', '#929dac'],
    light: ['#f3f4f6', '#ffffff', '#f7f8fa', '#e6e9ee', '#d8dde5', '#1c232b', '#536071', '#697586']
  },
  warm: {
    dark: ['#252019', '#302a22', '#3c342a', '#4a4033', '#665746', '#f7efdf', '#d0bfa6', '#b8a58b'],
    light: ['#eee4d2', '#faf3e5', '#f3e9d8', '#e4d6bc', '#c6b79a', '#342a1c', '#665337', '#7b684c']
  },
  slate: {
    dark: ['#12282a', '#1a3436', '#244246', '#2e5256', '#3f696c', '#e5f4f2', '#b0cec9', '#8ab3ae'],
    light: ['#dcecea', '#f1f9f7', '#e5f2ef', '#cbe2dc', '#9ebfb6', '#163934', '#42695e', '#567b70']
  },
  forest: {
    dark: ['#192b1c', '#22362a', '#2c4535', '#385741', '#506e59', '#edf5e8', '#bbceb5', '#9ab392'],
    light: ['#e2ecd9', '#f4f8ed', '#e9f1df', '#d4e2c6', '#afc19d', '#2b3c24', '#526748', '#667c59']
  },
  rose: {
    dark: ['#301c27', '#392631', '#4b323f', '#5b3e4e', '#795164', '#f9ebf0', '#dcbcc9', '#c49aaa'],
    light: ['#f1e0e7', '#fff4f7', '#f7e8ee', '#eccfda', '#d3a9ba', '#472b37', '#805366', '#936579']
  },
  violet: {
    dark: ['#211d31', '#2e2841', '#3d3555', '#4c4368', '#665b89', '#f1edfc', '#c9bfdc', '#aca0c7'],
    light: ['#e9e2f4', '#faf6ff', '#f0e9fa', '#e0d3ee', '#bfaed5', '#382c4d', '#695781', '#7b6892']
  },
  ocean: {
    dark: ['#10223d', '#18314a', '#223f5c', '#2c4e70', '#42678b', '#e9f2ff', '#b6cce5', '#93b0d1'],
    light: ['#d4e5f7', '#f2f8ff', '#e4effa', '#cadff0', '#9fbad0', '#203b51', '#4a6983', '#5d7c95']
  },
  amber: {
    dark: ['#3b2418', '#4a3020', '#5c3e29', '#704d31', '#947049', '#fff0df', '#dfc5a4', '#c5a982'],
    light: ['#f0d8bd', '#fff7ec', '#faecd9', '#eed8b9', '#d5b78d', '#4b341b', '#815c32', '#916c43']
  }
}

export function resolveTheme(appearance: AppearanceSettings, systemDark: boolean): ThemeId {
  if (appearance.mode === 'light' || (appearance.mode === 'system' && !systemDark)) return 'light'
  return appearance.palette === 'warm' || appearance.palette === 'slate' ? appearance.palette : 'graphite'
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}

function mix(color: string, target: string, amount: number): string {
  const other = rgb(target)
  return '#' + rgb(color).map((value, i) => Math.round(value + (other[i] - value) * amount).toString(16).padStart(2, '0')).join('')
}

function luminance(color: string): number {
  const channels = rgb(color).map((value) => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

export function contrastRatio(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function readableText(color: string, background: string, dark: boolean): string {
  let result = color
  for (let step = 1; contrastRatio(result, background) < 4.5 && step <= 20; step++) {
    result = mix(color, dark ? '#ffffff' : '#101113', step / 20)
  }
  return result
}

export function accentTokens(color: string, panel: string, dark: boolean): Record<string, string> {
  const foreground = contrastRatio(color, '#ffffff') >= contrastRatio(color, '#000000') ? '#ffffff' : '#000000'
  const textAccent = readableText(color, panel, dark)
  return {
    '--accent': color,
    '--accent-hover': mix(color, foreground === '#ffffff' ? '#101113' : '#ffffff', 0.12),
    '--accent-soft': `color-mix(in srgb, ${color} 16%, transparent)`,
    '--text-on-accent': foreground,
    '--text-accent': textAccent,
    '--border-accent': textAccent
  }
}

/** Apply every surface and text role in both modes, including with a fixed custom accent. */
export function paletteTokens(palette: ThemePalette, dark: boolean): Record<string, string> {
  const option = PALETTE_OPTIONS.find((item) => item.id === palette)!
  const [base, panel, raised, active, border, primary, secondary, muted] = PALETTE_SCALES[palette][dark ? 'dark' : 'light']
  return {
    '--bg-0': base,
    '--bg-1': panel,
    '--bg-2': raised,
    '--bg-3': active,
    '--border': border,
    '--text-0': readableText(primary, active, dark),
    '--text-1': readableText(secondary, active, dark),
    '--text-2': readableText(muted, active, dark),
    '--surface-hover': active,
    '--thumb-gradient-start': raised,
    '--thumb-gradient-end': panel,
    '--scrollbar-thumb-hover': border,
    '--accent': dark ? option.accent : option.lightAccent
  }
}

export function applyAppearance(appearance: AppearanceSettings, systemDark: boolean): void {
  const root = document.documentElement
  const theme = resolveTheme(appearance, systemDark)
  const dark = theme !== 'light'
  root.dataset.theme = theme
  root.dataset.palette = appearance.palette
  root.style.colorScheme = dark ? 'dark' : 'light'
  const colors = paletteTokens(appearance.palette, dark)
  const accent = appearance.customAccentEnabled ? appearance.customAccentColor : colors['--accent']
  for (const [key, value] of Object.entries({ ...colors, ...accentTokens(accent, colors['--bg-3'], dark) })) {
    root.style.setProperty(key, value)
  }
}
