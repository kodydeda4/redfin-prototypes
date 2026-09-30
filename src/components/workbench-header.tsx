"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ColumnsIcon,
  CopyIcon,
  MonitorIcon,
  MoonIcon,
  SearchIcon,
  SmartphoneIcon,
  SunIcon,
  TabletIcon,
  type LucideIcon,
} from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import { toast, Toaster } from "@/components/ui/toast"
import { features, locate, type Feature, type Variant, type VariantStatus } from "@/experiments/registry"
import { cn } from "@/lib/utils"

export type Layout = "iphone" | "ipad" | "both"

type Props = {
  path: string
  onNavigate: (path: string) => void
}

/** Shared look for every floating pill (feature dropdown, version cycler, device and appearance toggles). */
const FLOATING_PILL = "flex h-14 items-center rounded-full border bg-background p-1.5 shadow-sm"

/**
 * Desktop workbench header: the variant switcher on the left, the repo link on the right.
 * Clicking the switcher's name (or ⌘K) expands it into a search + browse panel for every feature.
 */
export function WorkbenchHeader({ path, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    // Clicking into a device iframe never reaches this document, but it does blur the window.
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("blur", close)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("blur", close)
    }
  }, [open])

  function navigate(next: string) {
    setOpen(false)
    onNavigate(next)
  }

  return (
    <div ref={root} className="relative z-20 shrink-0">
      {/* Floating controls over the canvas, like the bottom bar. */}
      <header className="flex items-center justify-between gap-6 px-5 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <VariantPager path={path} onNavigate={navigate} open={open} onToggle={() => setOpen((o) => !o)} />
          <CopyPrompt path={path} />
        </div>
        <Logo />
      </header>

      {open ? <Switcher current={locate(path).variant} onNavigate={navigate} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

/**
 * Carousel-style switcher for the current feature's variants: chevrons either side of the name,
 * dots underneath (the current one stretches into a pill). ← / → cycle too, wrapping around.
 */
function VariantPager({
  path,
  onNavigate,
  open,
  onToggle,
}: {
  path: string
  onNavigate: (path: string) => void
  open: boolean
  onToggle: () => void
}) {
  const { feature, variant } = locate(path)
  const { variants } = feature
  const index = variants.findIndex((v) => v.href === variant.href)
  const multiple = variants.length > 1

  function step(delta: number) {
    if (multiple) onNavigate(variants[(index + delta + variants.length) % variants.length].href)
  }

  const onArrow = useEffectEvent((delta: number) => step(delta))

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return
      if (e.key === "ArrowLeft") onArrow(-1)
      else if (e.key === "ArrowRight") onArrow(1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className={cn(FLOATING_PILL, "gap-1")}>
      {/* Which feature: icon + big name. Opens the switcher. */}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={onToggle}
        className={cn(
          "flex h-full items-center gap-2.5 rounded-full pr-3.5 pl-1.5 transition-colors hover:bg-muted",
          open && "bg-muted"
        )}
      >
        <CategoryIcon icon={feature.icon} size="sm" />
        <span className="text-lg font-bold tracking-tight whitespace-nowrap">{feature.title}</span>
        <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Which version: every version by name, the current one filled; the chevrons cycle. */}
      <span className="mx-1 h-6 w-px bg-border" />

      <div className="flex items-center gap-1">
        <StepButton label="Previous version" disabled={!multiple} onClick={() => step(-1)}>
          <ChevronLeftIcon />
        </StepButton>
        <div role="tablist" aria-label={`${feature.title} versions`} className="flex items-center gap-1.5">
          {variants.map((v, i) => {
            const active = i === index
            return (
              <button
                key={v.href}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onNavigate(v.href)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <span className={cn("size-2 rounded-full", statusStyles[v.status ?? "ideation"].dot)} />
                {v.title}
              </button>
            )
          })}
        </div>
        <StepButton label="Next version" disabled={!multiple} onClick={() => step(1)}>
          <ChevronRightIcon />
        </StepButton>
      </div>
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
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-5"
    >
      {children}
    </button>
  )
}

/**
 * A starter prompt for an AI coding agent about what's on screen: the feature, version, route, code
 * locations, and (from the URL) the selected tile, if any.
 */
function promptFor(path: string) {
  const { feature, variant } = locate(path)
  const folder = variant.href.split("/")[1]
  const params = new URLSearchParams(window.location.search)
  const tile = params.get("tile")
  const lines = [
    `I want to make changes to the ${feature.title} feature (${variant.title} version) in redfin-prototypes.`,
    "",
    `- Route: ${variant.href} (src/app${variant.href})`,
    `- Code: src/experiments/${folder}/`,
    `- Status: ${statusStyles[variant.status ?? "ideation"].label}`,
  ]
  if (path !== variant.href) lines.push(`- Currently viewing: ${path}`)
  if (tile) lines.push(`- Selected tile: ${tile}${params.get("variant") ? ` (${params.get("variant")} variant)` : ""}`)
  lines.push("", "Here's what I want to change: ")
  return lines.join("\n")
}

/** Copies `promptFor` the current page and confirms with a toast. */
function CopyPrompt({ path }: { path: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(promptFor(path))
      toast.add({ title: "Prompt Copied", type: "success" })
    } catch {
      toast.add({ title: "Couldn't copy the prompt", type: "error" })
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={cn(FLOATING_PILL, "gap-2 px-5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted")}
      >
        <CopyIcon className="size-4" /> Copy Prompt
      </button>
      {/* Toasts sit above the bottom bar so they don't cover the device toggle. */}
      <Toaster viewportClassName="bottom-24" />
    </>
  )
}

const statusStyles: Record<VariantStatus, { label: string; className: string; dot: string }> = {
  live: {
    label: "Live",
    className: "bg-green-500/15 text-green-700 ring-green-600/25 dark:text-green-400",
    dot: "bg-green-500",
  },
  ideation: {
    label: "Ideation",
    className: "bg-yellow-400/20 text-yellow-800 ring-yellow-500/30 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
}

/** Whether the variant on screen has shipped or is still an idea. */
export function StatusBadge({ path, className }: { path: string; className?: string }) {
  const { variant } = locate(path)
  const style = statusStyles[variant.status ?? "ideation"]
  return (
    <span
      key={variant.href}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap ring-1 ring-inset animate-in fade-in duration-200",
        style.className,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}

const REPO_URL = "https://github.com/kodydeda4/redfin-prototypes"

/** App icon + wordmark on the same floating pill as the bottom-bar toggles; links to the repo. */
function Logo() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Redfin on GitHub"
      className={cn(FLOATING_PILL, "shrink-0 gap-2.5 px-2.5 whitespace-nowrap xl:pr-5 transition-colors hover:bg-muted")}
    >
      {/* The Redfin icon carries its own rounded shape and margin, so it isn't clipped here. */}
      <Image src="/redfin-logo.png" alt="" width={32} height={32} preload className="size-8" />
      {/* Narrower windows show just the icon so the header doesn't overflow. */}
      <span className="hidden text-sm font-medium xl:inline">Redfin Prototypes</span>
    </a>
  )
}

/** Monochrome app-icon tile: iOS corner radius, soft gradient, hairline edge. */
function CategoryIcon({ icon: Icon, size = "lg", className }: { icon: LucideIcon; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[22.37%] bg-linear-to-b from-neutral-100 to-neutral-200 text-foreground shadow-sm outline outline-1 -outline-offset-1 outline-black/5 dark:from-neutral-700 dark:to-neutral-800 dark:outline-white/10",
        size === "lg" ? "size-14 [&_svg]:size-7" : "size-8 [&_svg]:size-4",
        className
      )}
    >
      <Icon strokeWidth={1.75} />
    </span>
  )
}

type Result = { feature: Feature; variant: Variant }

function search(query: string): Result[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return features.flatMap((feature) =>
    feature.variants
      .filter((variant) => {
        const haystack = `${feature.title} ${variant.title}`.toLowerCase()
        return terms.every((t) => haystack.includes(t))
      })
      .map((variant) => ({ feature, variant }))
  )
}

/** Panel under the switcher: a search field, then every feature as a column of its variants. */
function Switcher({ current, onNavigate, onClose }: { current: Variant; onNavigate: (path: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(() => Math.max(0, search("").findIndex((r) => r.variant.href === current.href)))
  const results = search(query)
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  // Every category shows while browsing; searching keeps the ones with a match (by name or variant).
  const columns = features
    .map((feature) => ({ feature, rows: results.filter((r) => r.feature === feature) }))
    .filter((c) => c.rows.length > 0 || terms.every((t) => c.feature.title.toLowerCase().includes(t)))

  return (
    <div
      role="dialog"
      aria-label="Switch feature"
      className="absolute top-full right-5 left-5 mt-2 overflow-hidden rounded-3xl border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          placeholder="Search features…"
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setHighlight((h) => Math.min(h + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
            } else if (e.key === "Enter") {
              const r = results[highlight]
              if (r) onNavigate(r.variant.href)
            } else if (e.key === "Escape") {
              onClose()
            }
          }}
          className="h-14 w-full bg-transparent pr-16 pl-13 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <Kbd className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2">esc</Kbd>
      </div>

      {columns.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No matches</p>
      ) : (
        // One row: every category side by side, scrolling sideways if the window is narrow.
        <div className="flex gap-2 overflow-x-auto px-3 pb-3">
          {columns.map(({ feature, rows }) => (
            // Each category is its own card, its header a shade darker than its list.
            <div key={feature.slug} className="min-w-36 flex-1 overflow-hidden rounded-2xl bg-muted/30">
              <div className="flex flex-col items-center gap-3 bg-muted/80 px-3 pt-4 pb-3 text-center">
                <CategoryIcon icon={feature.icon} />
                <div className="w-full min-w-0">
                  <p className="truncate text-[15px] font-semibold">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {feature.variants.length === 1 ? "1 version" : `${feature.variants.length || "No"} versions`}
                  </p>
                </div>
              </div>
              <ul className="space-y-0.5 p-1.5">
                {rows.map((r) => {
                  const i = results.indexOf(r)
                  const status = statusStyles[r.variant.status ?? "ideation"]
                  return (
                    <li key={r.variant.href}>
                      <button
                        type="button"
                        onClick={() => onNavigate(r.variant.href)}
                        onMouseEnter={() => setHighlight(i)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                          i === highlight && "bg-foreground/[0.07]"
                        )}
                      >
                        <span className="flex-1 truncate text-[17px] font-semibold tracking-tight">{r.variant.title}</span>
                        {r.variant.href === current.href ? <CheckIcon className="size-4 shrink-0 text-muted-foreground" /> : null}
                        <span
                          title={status.label}
                          aria-label={status.label}
                          className={cn("size-2 shrink-0 rounded-full", status.dot)}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const deviceOptions = [
  { value: "iphone", label: "iPhone", icon: SmartphoneIcon },
  { value: "ipad", label: "iPad", icon: TabletIcon },
  { value: "both", label: "Both", icon: ColumnsIcon },
] as const

/** iPhone / iPad / Both, styled to match the variant switcher (the workbench floats it bottom-right). */
export function DeviceToggle({
  layout,
  onChange,
  className,
}: {
  layout: Layout
  onChange: (layout: Layout) => void
  className?: string
}) {
  return <SegmentedPill label="Device layout" options={deviceOptions} value={layout} onChange={onChange} className={className} />
}

const themeOptions = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const

/**
 * System / Light / Dark, styled like the device toggle (the workbench floats it bottom-left).
 * Theme lives outside the devices; the iframes pick it up via next-themes' storage sync.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <SegmentedPill
      label="Appearance"
      options={themeOptions}
      value={theme}
      onChange={setTheme}
      className={className}
    />
  )
}

/** Rounded segmented control on a floating pill, shared by the device and appearance toggles. */
function SegmentedPill<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: readonly { value: T; label: string; icon: React.ComponentType }[]
  value: string | undefined
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn(FLOATING_PILL, "gap-1", className)}>
      {options.map(({ value: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "flex h-full items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors [&_svg]:size-4",
            value === option ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon /> {label}
        </button>
      ))}
    </div>
  )
}
