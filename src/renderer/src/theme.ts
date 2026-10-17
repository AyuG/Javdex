import type { ThemeId } from '@shared/settingsTypes'
import type { AppearanceSettings, ThemePalette } from '@shared/appearance'

export const PALETTE_OPTIONS: { id: ThemePalette; label: string; hint: string; accent: string; lightAccent: string }[] = [
  { id: 'graphite', label: '石墨', hint: '中性灰 · 经典蓝', accent: '#5a8fc8', lightAccent: '#3f6fb5' },
  { id: 'warm', label: '暖灰', hint: '温润灰 · 柔和金', accent: '#a9966a', lightAccent: '#806a38' },
  { id: 'slate', label: '青灰', hint: '冷调灰 · 雾青色', accent: '#63a7ad', lightAccent: '#30787e' },
  { id: 'forest', label: '苔绿', hint: '柔和灰 · 鼠尾草', accent: '#80ab8e', lightAccent: '#437755' },
  { id: 'rose', label: '烟玫', hint: '柔雾灰 · 玫瑰色', accent: '#c18d9e', lightAccent: '#9b526c' },
  { id: 'violet', label: '暮紫', hint: '冷雾灰 · 鸢尾紫', accent: '#a195c9', lightAccent: '#7660a7' }
]

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

export function accentTokens(color: string, panel: string, dark: boolean): Record<string, string> {
  const foreground = contrastRatio(color, '#ffffff') >= contrastRatio(color, '#000000') ? '#ffffff' : '#000000'
  let textAccent = color
  for (let step = 1; contrastRatio(textAccent, panel) < 4.5 && step <= 20; step++) {
    textAccent = mix(color, dark ? '#ffffff' : '#101113', step / 20)
  }
  return {
    '--accent': color,
    '--accent-hover': mix(color, foreground === '#ffffff' ? '#101113' : '#ffffff', 0.12),
    '--accent-soft': `color-mix(in srgb, ${color} 16%, transparent)`,
    '--text-on-accent': foreground,
    '--text-accent': textAccent,
    '--border-accent': textAccent
  }
}

/** Neutral surfaces remain the main area of every palette. */
export function paletteTokens(palette: ThemePalette, dark: boolean): Record<string, string> {
  const option = PALETTE_OPTIONS.find((item) => item.id === palette)!
  if (dark && palette === 'warm') return { '--bg-0': '#121110', '--bg-1': '#1a1816', '--bg-2': '#24211e', '--accent': option.accent }
  if (dark && palette === 'slate') return { '--bg-0': '#0f1216', '--bg-1': '#151a20', '--bg-2': '#1e252d', '--accent': option.accent }
  const tint = palette === 'graphite' ? 0 : 0.04
  return {
    '--bg-0': mix(dark ? '#101113' : '#f3f4f6', option.accent, tint),
    '--bg-1': mix(dark ? '#17191c' : '#ffffff', option.accent, tint),
    '--bg-2': mix(dark ? '#202329' : '#f7f8fa', option.accent, tint),
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
  for (const [key, value] of Object.entries({ ...colors, ...accentTokens(accent, colors['--bg-1'], dark) })) {
    root.style.setProperty(key, value)
  }
}
