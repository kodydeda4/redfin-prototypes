"use client"

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"

// JSON values in Web Storage that every workbench frame shares, like the Swift app's `@Shared`.
// Same-document writes notify through `listeners`; other frames and tabs hear about them through the
// `storage` event.
//
// - `useStored` / `writeStored` (localStorage): app data that outlives the tab — the session, the
//   selected library.
// - `useSynced` (sessionStorage): UI state the iPhone and iPad frames keep in step — the selected
//   sidebar row, the open album. Same-origin frames in one tab share sessionStorage, so a tap in
//   either device shows in both; a new tab starts fresh.

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function write<T>(area: Storage, key: string, value: T | null) {
  if (value === null) area.removeItem(key)
  else area.setItem(key, JSON.stringify(value))
  listeners.forEach((l) => l())
}

function useValue<T>(area: () => Storage, key: string): T | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => area().getItem(key),
    () => undefined,
  )
  return useMemo(() => {
    if (raw === undefined) return undefined
    try {
      return raw === null ? null : (JSON.parse(raw) as T)
    } catch {
      return null
    }
  }, [raw])
}

const local = () => localStorage
const session = () => sessionStorage

export function writeStored<T>(key: string, value: T | null) {
  write(localStorage, key, value)
}

/** The stored value: `undefined` until hydrated, `null` when nothing's saved. */
export function useStored<T>(key: string): T | null | undefined {
  return useValue<T>(local, key)
}

/**
 * Namespaces `useSynced` state, so each feature page keeps its own (Album Details Live opening an album
 * doesn't leave it open on Albums Live).
 */
export const SyncScope = createContext("app")

/**
 * UI state shared by the workbench's device frames, starting at `initial`. Only ever *set* it (never
 * toggle from the current value): the workbench also replays each tap in the other frame, and a set
 * is harmless to repeat where a toggle would undo itself.
 */
export function useSynced<T>(key: string, initial: T): [T, (value: T) => void] {
  const storageKey = `redfin:sync:${useContext(SyncScope)}:${key}`
  const stored = useValue<T>(session, storageKey)
  const set = useCallback((value: T) => write(sessionStorage, storageKey, value), [storageKey])
  return [stored ?? initial, set]
}
