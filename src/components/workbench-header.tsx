"use client"

import { useEffect, useEffectEvent } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ColumnsIcon,
  CopyIcon,
  MonitorIcon,
  MoonIcon,
  SmartphoneIcon,
  SunIcon,
  TabletIcon,
} from "lucide-react"

import { FeatureSidebarToggle } from "@/components/feature-sidebar"
import { PreviewStateToggle } from "@/components/preview-state"
import { FEATURES_KEY, useSidebarOpen } from "@/components/sidebars"
import { toast, Toaster } from "@/components/ui/toast"
import { CategoryIcon, statusStyles } from "@/components/workbench-ui"
import { locate } from "@/experiments/registry"
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
  return (
    <div className="relative z-20 shrink-0">
      {/* Floating controls over the canvas, like the bottom bar. */}
      <header className="flex items-center justify-between gap-6 px-5 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <FeatureSidebarToggle className={cn(FLOATING_PILL, "w-14")} />
          <VariantPager path={path} onNavigate={onNavigate} />
          <CopyPrompt path={path} />
        </div>
        <div className="flex items-center gap-3">
          <Logo />
          <PreviewStateToggle className={cn(FLOATING_PILL, "w-14")} />
        </div>
      </header>
    </div>
  )
}

/**
 * Carousel-style switcher for the current feature's variants: chevrons either side of the name,
 * dots underneath (the current one stretches into a pill). ← / → cycle too, wrapping around.
 */
function VariantPager({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const { feature, variant } = locate(path)
  const [isSidebarOpen, setSidebarOpen] = useSidebarOpen(FEATURES_KEY)
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
      {/* Which feature: icon + big name. Shows or hides the Features sidebar. */}
      <button
        type="button"
        aria-expanded={isSidebarOpen}
        aria-label={`${feature.title} — ${isSidebarOpen ? "hide" : "show"} Features`}
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className="flex h-full items-center gap-2.5 rounded-full pr-4 pl-1.5 transition-colors hover:bg-muted"
      >
        <CategoryIcon icon={feature.icon} size="sm" />
        <span className="text-lg font-bold tracking-tight whitespace-nowrap">{feature.title}</span>
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
