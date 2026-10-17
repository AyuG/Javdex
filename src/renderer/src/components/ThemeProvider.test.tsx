import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { DEFAULT_SETTINGS } from '@shared/settingsTypes'
import { DEFAULT_APPEARANCE, type AppearanceSettings } from '@shared/appearance'

Object.defineProperty(globalThis, 'React', { configurable: true, value: React })
let read = async (): Promise<unknown> => DEFAULT_SETTINGS
let write = async (_patch: unknown): Promise<unknown> => ({})
const listeners = new Set<() => void>()
const media = {
  matches: true,
  addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
  removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener)
}
const css = new Map<string, string>()
const root = { dataset: {} as Record<string, string>, style: { colorScheme: '', setProperty: (key: string, value: string) => css.set(key, value) } }
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  matchMedia: () => media,
  api: { settings: { get: () => read(), update: (patch: unknown) => write(patch) } }
} })
Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: root } })
let renderer: TestRenderer.ReactTestRenderer | undefined
let change: (patch: Partial<AppearanceSettings>) => Promise<void>
let current: AppearanceSettings

async function mount(): Promise<void> {
  const { ThemeProvider, useTheme } = await import('./ThemeProvider')
  function Harness(): JSX.Element {
    const value = useTheme()
    change = value.setAppearance
    current = value.appearance
    return <span>{value.theme}</span>
  }
  await act(async () => { renderer = TestRenderer.create(<ThemeProvider><Harness /></ThemeProvider>) })
}

beforeEach(() => {
  read = async () => DEFAULT_SETTINGS
  write = async () => ({})
  media.matches = true
  css.clear()
})
afterEach(() => {
  act(() => renderer?.unmount())
  renderer = undefined
  assert.equal(listeners.size, 0)
})

describe('ThemeProvider', () => {
  it('reacts to system changes and removes the subscription on unmount', async () => {
    const writes: unknown[] = []
    write = async (patch) => { writes.push(patch); return {} }
    await mount()
    await act(async () => { await change({ mode: 'system', palette: 'forest' }) })
    assert.equal(root.dataset.theme, 'graphite')
    act(() => { media.matches = false; listeners.forEach((listener) => listener()) })
    assert.equal(root.dataset.theme, 'light')
    assert.equal(current.palette, 'forest')
    assert.equal(writes.length, 1)
    await act(async () => { await change({ mode: 'dark' }) })
    act(() => { media.matches = true; listeners.forEach((listener) => listener()) })
    assert.equal(root.dataset.theme, 'graphite')
  })

  it('preserves stored fields when a user clicks before initial settings loading finishes', async () => {
    let resolve!: (value: unknown) => void
    read = () => new Promise((done) => { resolve = done })
    const stored = { ...DEFAULT_APPEARANCE, palette: 'warm', customAccentEnabled: true, customAccentColor: '#ffcc00' } as const
    let saved: unknown
    write = async (patch) => { saved = patch; return {} }
    await mount()
    let operation!: Promise<void>
    act(() => { operation = change({ mode: 'light' }) })
    await act(async () => { resolve({ ...DEFAULT_SETTINGS, appearance: stored }); await operation })
    assert.deepEqual(saved, { appearance: { ...stored, mode: 'light' } })
    assert.deepEqual(current, { ...stored, mode: 'light' })
  })

  it('serializes rapid changes and rolls back a failed latest save to the last successful values', async () => {
    const writes: unknown[] = []
    write = async (patch) => { writes.push(patch); if (writes.length === 2) throw new Error('disk full'); return {} }
    await mount()
    let first!: Promise<void>
    let second!: Promise<void>
    await act(async () => {
      first = change({ palette: 'rose' })
      second = change({ mode: 'light' })
      await first
      await assert.rejects(second, /disk full/)
    })
    assert.deepEqual(current, { ...DEFAULT_APPEARANCE, palette: 'rose' })
    assert.equal(root.dataset.theme, 'graphite')
    assert.equal(writes.length, 2)
  })

  it('does not let an older failed save undo a later selection', async () => {
    let calls = 0
    write = async () => { if (++calls === 1) throw new Error('disk full'); return {} }
    await mount()
    await act(async () => {
      const older = change({ palette: 'violet' }).catch(() => {})
      const newer = change({ mode: 'light' })
      await Promise.all([older, newer])
    })
    assert.equal(root.dataset.theme, 'light')
    assert.equal(current.mode, 'light')
  })
})
