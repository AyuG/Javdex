import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { DEFAULT_APPEARANCE, isAccentColor, type AppearanceSettings } from '@shared/appearance'
import { PALETTE_OPTIONS, paletteTokens } from '../../theme'
import { useTheme } from '../ThemeProvider'
import { useToast } from '../Toast'
import Button from '../Button'
import SettingsSwitchRow from '../SettingsSwitchRow'
import { AppFormChoiceGroup } from '../FormPrimitives'
import { SettingsCard } from './SettingsPrimitives'
import styles from './ThemeSettingsCard.module.css'

const MODES = [
  { id: 'system', label: '跟随系统', Icon: Monitor },
  { id: 'light', label: '浅色', Icon: Sun },
  { id: 'dark', label: '深色', Icon: Moon }
] as const

const ACCENTS = [
  { color: '#5a8fc8', label: '经典蓝' }, { color: '#63a7ad', label: '雾青' },
  { color: '#80ab8e', label: '苔绿' }, { color: '#a9966a', label: '柔金' },
  { color: '#d59065', label: '暖橙' }, { color: '#c18d9e', label: '烟玫' },
  { color: '#a195c9', label: '暮紫' }, { color: '#929ba8', label: '银灰' }
]

function navigateChoices(event: KeyboardEvent<HTMLDivElement>): void {
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (index < 0) return
  const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : step ? (index + step + buttons.length) % buttons.length : -1
  if (next < 0) return
  event.preventDefault()
  buttons[next].focus()
  buttons[next].click()
}

export default function ThemeSettingsCard(): JSX.Element {
  const { theme, appearance, setAppearance } = useTheme()
  const toast = useToast()
  const [colorDraft, setColorDraft] = useState(appearance.customAccentColor)
  const [colorError, setColorError] = useState('')
  const [pending, setPending] = useState(0)
  const [saveError, setSaveError] = useState(false)
  const changeRevision = useRef(0)
  useEffect(() => { setColorDraft(appearance.customAccentColor) }, [appearance.customAccentColor])

  const change = async (patch: Partial<AppearanceSettings>): Promise<void> => {
    const revision = ++changeRevision.current
    if (patch.customAccentColor) setColorDraft(patch.customAccentColor)
    setPending((count) => count + 1)
    setSaveError(false)
    setColorError('')
    try {
      await setAppearance(patch)
      if (revision === changeRevision.current) setSaveError(false)
    } catch (error) {
      if (revision === changeRevision.current) setSaveError(true)
      toast.show(`外观设置保存失败：${(error as Error).message}`, 'error')
    } finally {
      setPending((count) => count - 1)
    }
  }
  const applyColor = (): void => {
    if (!isAccentColor(colorDraft)) {
      setColorError('请输入六位十六进制颜色，例如 #5A8FC8。')
      return
    }
    void change({ customAccentColor: colorDraft.toLowerCase() })
  }
  const dark = theme !== 'light'
  return (
    <SettingsCard title="主题与配色" hint="选择即生效，自动保存。自选颜色请点击应用。"
      className={styles.root}
      actions={<Button size="sm" title="仅恢复主题与配色为默认值" onClick={() => void change({ ...DEFAULT_APPEARANCE })}>
        <RotateCcw size={14} aria-hidden />恢复默认
      </Button>}>
      <div className={styles.modeRow}>
        <span className={styles.label}>主题模式</span>
        <div className={styles.modes} role="radiogroup" aria-label="主题模式" onKeyDown={navigateChoices}>
          {MODES.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={appearance.mode === id}
              tabIndex={appearance.mode === id ? 0 : -1} onClick={() => void change({ mode: id })}>
              <Icon size={16} aria-hidden />{label}
            </button>
          ))}
        </div>
      </div>
      <AppFormChoiceGroup label="配色方案">
        <div className={styles.palettes} role="radiogroup" aria-label="配色方案" onKeyDown={navigateChoices}>
          {PALETTE_OPTIONS.map((option) => {
            const colors = paletteTokens(option.id, dark)
            return (
              <button key={option.id} type="button" role="radio" aria-checked={appearance.palette === option.id}
                tabIndex={appearance.palette === option.id ? 0 : -1} className={styles.palette}
                onClick={() => void change({ palette: option.id })}>
                <span className={styles.preview} aria-hidden style={{
                  '--preview-base': colors['--bg-0'], '--preview-panel': colors['--bg-1'],
                  '--preview-raised': colors['--bg-3'],
                  '--preview-accent': appearance.customAccentEnabled ? appearance.customAccentColor : colors['--accent']
                } as CSSProperties}>
                  <span className={styles.previewSidebar}><i /><i /><i /></span>
                  <span className={styles.previewContent}><i /><span><i /><i /><i /></span></span>
                </span>
                <span className={styles.paletteLabel}>{option.label}
                  {appearance.palette === option.id && <Check size={14} aria-hidden />}
                </span>
                <span className={styles.hint}>{option.hint}</span>
              </button>
            )
          })}
        </div>
      </AppFormChoiceGroup>
      <p className={styles.paletteNote}>
        {appearance.customAccentEnabled
          ? '自定义强调色已开启：切换配色会更改背景、面板和文字，强调色保持不变。'
          : '每套配色均有独立的深色和浅色外观，同时更改背景、面板、文字和强调色。'}
      </p>
      <div className={styles.accentSection}>
        <SettingsSwitchRow title="自定义强调色" description="替换按钮、选中项和链接的强调色，保留当前配色的背景。"
          checked={appearance.customAccentEnabled} onChange={(checked) => void change({ customAccentEnabled: checked })} />
        {appearance.customAccentEnabled && <div className={styles.accentControls}>
          <div className={styles.swatches} role="radiogroup" aria-label="强调色" onKeyDown={navigateChoices}>
            {ACCENTS.map(({ color, label }, index) => {
              const selected = appearance.customAccentColor === color
              const hasPreset = ACCENTS.some((item) => item.color === appearance.customAccentColor)
              return <button key={color} type="button" role="radio" aria-checked={selected}
                aria-label={label} title={label} tabIndex={selected || (!hasPreset && index === 0) ? 0 : -1}
                style={{ '--swatch-color': color } as CSSProperties} className={styles.swatch}
                onClick={() => void change({ customAccentColor: color })}>
                {selected && <Check size={16} aria-hidden />}
              </button>
            })}
          </div>
          <div className={styles.customColor}>
            <label className={styles.colorPicker}>自选颜色
              <input type="color" aria-label="选择自选颜色" value={isAccentColor(colorDraft) ? colorDraft : appearance.customAccentColor}
                onChange={(event) => { setColorDraft(event.target.value); setColorError('') }} />
            </label>
            <input className={styles.hex} aria-label="强调色十六进制值" value={colorDraft} maxLength={7} spellCheck={false}
              aria-invalid={!!colorError} aria-describedby={colorError ? 'theme-color-error' : undefined}
              onChange={(event) => { setColorDraft(event.target.value); setColorError('') }}
              onKeyDown={(event) => { if (event.key === 'Enter') applyColor() }} />
            <Button size="sm" onClick={applyColor} disabled={colorDraft.toLowerCase() === appearance.customAccentColor}>应用</Button>
          </div>
          {colorError && <p id="theme-color-error" className={styles.error} role="alert">{colorError}</p>}
        </div>}
      </div>
      <p className={styles.status} role="status">{pending ? '正在保存…' : saveError ? '保存失败，请重试' : '已保存'}
        <span>当前{dark ? '深色' : '浅色'}外观{appearance.mode === 'system' ? ' · 随系统自动切换' : ''}</span>
      </p>
    </SettingsCard>
  )
}
