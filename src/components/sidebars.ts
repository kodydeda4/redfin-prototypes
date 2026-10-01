"use client"

import { useEffect } from "react"

import { useStored, writeStored } from "@/lib/stored"

// The workbench's two docked sidebars — Features on the left, Preview State on the right — and the
// `|` shortcut that shows or hides them together. Each remembers whether it's open.

export const FEATURES_KEY = "redfin:features-open"
export const PREVIEW_STATE_KEY = "redfin:preview-state-open"

export const SIDEBARS_SHORTCUT = "|"

/** Sent to the workbench window after ⌘K opens Features, so it can put the cursor in the search. */
export const FOCUS_FEATURE_SEARCH = "redfin:focus-feature-search"

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
 * The sidebars' keyboard shortcuts, used by the workbench and by each device frame so they work
 * wherever focus is (a frame writes the shared stored flags, and the workbench hears about it):
 *
 * - `|` hides both sidebars if either is open, and shows both if neither is. Ignored while typing in a
 *   field, and with ⌘ / Ctrl / ⌥ held.
 * - ⌘K / Ctrl+K shows or hides Features — even from a field — and showing it focuses its search.
 */
export function useSidebarsShortcut() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return

      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        const show = !isOpen(FEATURES_KEY)
        writeStored(FEATURES_KEY, show)
        // The sidebar lives in the workbench window, even when the key was pressed inside a device.
        if (show) window.top?.dispatchEvent(new Event(FOCUS_FEATURE_SEARCH))
        return
      }

      if (e.key !== SIDEBARS_SHORTCUT || e.metaKey || e.ctrlKey || e.altKey) return
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
