"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

import type { TileInfo } from "@/experiments/home/focus"
import { cn } from "@/lib/utils"

type SaveState = "idle" | "saving" | "saved" | "error"

/**
 * Panel floating over the bottom of the device stage for the focused tile: its notes (saved to notes/tiles.json as you type)
 * and a switcher for the tile's variants.
 */
export function TileNotes({
  tile,
  onVariant,
  onClose,
}: {
  tile: TileInfo
  onVariant: (variant: number) => void
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>("idle")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Load this tile's note.
  useEffect(() => {
    let cancelled = false
    fetch("/api/notes")
      .then((r) => r.json() as Promise<Record<string, string>>)
      .then((notes) => {
        if (cancelled) return
        setText(notes[tile.key] ?? "")
        setLoadedKey(tile.key)
        setSave("idle")
      })
      .catch(() => !cancelled && setSave("error"))
    return () => {
      cancelled = true
      clearTimeout(timer.current)
    }
  }, [tile.key])

  function change(next: string) {
    setText(next)
    setSave("saving")
    clearTimeout(timer.current)
    const key = tile.key
    timer.current = setTimeout(() => {
      fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, text: next }),
      })
        .then((r) => setSave(r.ok ? "saved" : "error"))
        .catch(() => setSave("error"))
    }, 500)
  }

  const count = tile.variants.length
  const step = (delta: number) => onVariant((tile.variant + delta + count) % count)

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <section className="flex w-full flex-col gap-3 rounded-3xl border bg-background p-4 shadow-lg">
        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{tile.title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {tile.key.replace("#", " · ")} · {count} {count === 1 ? "variant" : "variants"}
            </p>
          </div>

          {/* Variant switcher */}
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-1">
            <StepButton label="Previous variant" disabled={count < 2} onClick={() => step(-1)}>
              <ChevronLeftIcon />
            </StepButton>
            {tile.variants.map((name, i) => (
              <button
                key={name}
                type="button"
                aria-pressed={i === tile.variant}
                onClick={() => onVariant(i)}
                className={cn(
                  "h-8 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  i === tile.variant ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {name}
              </button>
            ))}
            <StepButton label="Next variant" disabled={count < 2} onClick={() => step(1)}>
              <ChevronRightIcon />
            </StepButton>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <textarea
          value={text}
          disabled={loadedKey !== tile.key}
          onChange={(e) => change(e.target.value)}
          placeholder="What does this tile do? What are its variants exploring?"
          rows={3}
          className="w-full resize-y rounded-2xl bg-muted p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <p className="-mt-1 text-right text-xs text-muted-foreground">
          {save === "saving" ? "Saving…" : save === "saved" ? "Saved to notes/tiles.json" : save === "error" ? "Couldn't save" : ""}
        </p>
      </section>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  )
}
