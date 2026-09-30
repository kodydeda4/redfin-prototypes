"use client"

import { useEffect } from "react"

import { useStored, writeStored } from "@/lib/stored"

// The workbench's two docked sidebars — Features on the left, Preview State on the right — and the
// `|` shortcut that shows or hides them together. Each remembers whether it's open.

export const FEATURES_KEY = "redfin:features-open"
export const PREVIEW_STATE_KEY = "redfin:preview-state-open"

export const SIDEBARS_SHORTCUT = "|"

/** Whether a sidebar is open (both start open), and a setter. */
export function useSidebarOpen(key: string): [boolean, (open: boolean) => void] {
  return [useStored<boolean>(key) ?? true, (open) => writeStored(key, open)]
}

function isOpen(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "true") !== false
  } catch {
    return true
  }
}

/**
 * `|` hides both sidebars if either is open, and shows both if neither is. Used by the workbench and by
 * each device frame, so it works wherever focus is — a frame writes the shared stored flags, and the
 * workbench hears about it. Ignored while typing in a field, and with ⌘ / Ctrl / ⌥ held.
 */
export function useSidebarsShortcut() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== SIDEBARS_SHORTCUT || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select, [role=combobox]"))
      ) {
        return
      }
      e.preventDefault()
      // Read at press time, not from a render, so it's never stale.
      const show = !isOpen(FEATURES_KEY) && !isOpen(PREVIEW_STATE_KEY)
      writeStored(FEATURES_KEY, show)
      writeStored(PREVIEW_STATE_KEY, show)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
