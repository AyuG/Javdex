import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { PRIVACY_MODE_SCOPES, type ThemeId } from '@shared/settingsTypes'
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppearanceSettings } from '@shared/appearance'
import { api } from '../api'
import { applyPrivacyMode, readCachedPrivacyMode, type PrivacyModeSettings } from '../privacyMode'
import { applyAppearance, resolveTheme } from '../theme'

interface ThemeCtx {
  theme: ThemeId
  appearance: AppearanceSettings
  setAppearance: (patch: Partial<AppearanceSettings>) => Promise<void>
  privacyMode: PrivacyModeSettings
  syncPrivacyMode: (settings: PrivacyModeSettings) => void
}

const DEFAULT_PRIVACY_MODE: PrivacyModeSettings = {
  privacyModeEnabled: false,
  privacyModeScopes: [...PRIVACY_MODE_SCOPES]
}

const Ctx = createContext<ThemeCtx>({
  theme: 'graphite',
  appearance: DEFAULT_APPEARANCE,
  setAppearance: async () => {},
  privacyMode: DEFAULT_PRIVACY_MODE,
  syncPrivacyMode: () => {}
})

export function useTheme(): ThemeCtx {
  return useContext(Ctx)
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [appearance, setAppearanceState] = useState<AppearanceSettings>(DEFAULT_APPEARANCE)
  const appearanceRef = useRef(appearance)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  const theme = resolveTheme(appearance, systemDark)
  const [privacyMode, setPrivacyModeState] = useState<PrivacyModeSettings>(
    () => readCachedPrivacyMode() ?? DEFAULT_PRIVACY_MODE
  )
  const privacyRevisionRef = useRef(0)
  const themeRevisionRef = useRef(0)
  const savedThemeRef = useRef<AppearanceSettings>(DEFAULT_APPEARANCE)
  const themeQueueRef = useRef(Promise.resolve())

  useLayoutEffect(() => {
    applyAppearance(appearance, systemDark)
  }, [appearance, systemDark])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const changed = (): void => setSystemDark(media.matches)
    changed()
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])

  useEffect(() => {
    const privacyRevision = privacyRevisionRef.current
    const themeRevision = themeRevisionRef.current
    themeQueueRef.current = api.settings
      .get()
      .then((s) => {
        const t = normalizeAppearance(s.appearance, s.theme)
        savedThemeRef.current = t
        if (themeRevision === themeRevisionRef.current) {
          appearanceRef.current = t
          setAppearanceState(t)
        }
        if (privacyRevision === privacyRevisionRef.current) {
          applyPrivacyMode(s)
          setPrivacyModeState(s)
        }
      })
      .catch(() => {
        // The default appearance is already applied; privacy has its own cache.
      })
  }, [])

  const setAppearance = useCallback(async (patch: Partial<AppearanceSettings>) => {
    const next = normalizeAppearance({ ...appearanceRef.current, ...patch })
    const revision = ++themeRevisionRef.current
    appearanceRef.current = next
    setAppearanceState(next)
    const operation = themeQueueRef.current
      .catch(() => {})
      .then(async () => {
        try {
          // Merge after initial loading and preceding writes, so a quick click cannot
          // overwrite preferences that have not finished loading yet.
          const persisted = normalizeAppearance({ ...savedThemeRef.current, ...patch })
          await api.settings.update({ appearance: persisted })
          savedThemeRef.current = persisted
          if (revision === themeRevisionRef.current) {
            appearanceRef.current = persisted
            setAppearanceState(persisted)
          }
        } catch (error) {
          if (revision === themeRevisionRef.current) {
            appearanceRef.current = savedThemeRef.current
            setAppearanceState(savedThemeRef.current)
          }
          throw error
        }
      })
    themeQueueRef.current = operation.catch(() => {})
    await operation
  }, [])

  const syncPrivacyMode = useCallback((settings: PrivacyModeSettings) => {
    privacyRevisionRef.current += 1
    applyPrivacyMode(settings)
    setPrivacyModeState(settings)
  }, [])

  return (
    <Ctx.Provider value={{ theme, appearance, setAppearance, privacyMode, syncPrivacyMode }}>
      {children}
    </Ctx.Provider>
  )
}
