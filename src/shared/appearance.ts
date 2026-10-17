export const THEME_MODES = ['system', 'light', 'dark'] as const
export const THEME_PALETTES = ['graphite', 'warm', 'slate', 'forest', 'rose', 'violet', 'ocean', 'amber'] as const
export type ThemeMode = (typeof THEME_MODES)[number]
export type ThemePalette = (typeof THEME_PALETTES)[number]

export interface AppearanceSettings {
  mode: ThemeMode
  palette: ThemePalette
  customAccentEnabled: boolean
  customAccentColor: string
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  mode: 'dark',
  palette: 'graphite',
  customAccentEnabled: false,
  customAccentColor: '#5a8fc8'
}

export function isAccentColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

/** Missing new preferences inherit the four themes used by older installations. */
export function normalizeAppearance(value: unknown, legacyTheme?: unknown): AppearanceSettings {
  const source = value && typeof value === 'object' ? value as Partial<AppearanceSettings> : {}
  const legacyPalette = legacyTheme === 'warm' || legacyTheme === 'slate' ? legacyTheme : 'graphite'
  return {
    mode: THEME_MODES.includes(source.mode!) ? source.mode! : legacyTheme === 'light' ? 'light' : 'dark',
    palette: THEME_PALETTES.includes(source.palette!) ? source.palette! : legacyPalette,
    customAccentEnabled: source.customAccentEnabled === true,
    customAccentColor: isAccentColor(source.customAccentColor)
      ? source.customAccentColor.toLowerCase() : DEFAULT_APPEARANCE.customAccentColor
  }
}
