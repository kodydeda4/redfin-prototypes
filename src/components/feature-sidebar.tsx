"use client"

import { useEffect, useRef, useState } from "react"
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from "lucide-react"

import { FEATURES_KEY, FOCUS_FEATURE_SEARCH, SIDEBARS_SHORTCUT, useSidebarOpen } from "@/components/sidebars"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { CategoryIcon, search, statusStyles, type Result } from "@/components/workbench-ui"
import { locate, sections } from "@/experiments/registry"
import { cn } from "@/lib/utils"

// The workbench's collapsible left-hand "Features" sidebar (mirroring Preview State on the right):
// every section as a heading with its features under it, each feature's versions beneath it, and a
// search that narrows them all. ⌘K shows or hides it (focusing the search when it opens).

export function FeatureSidebar({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const [isOpen, setOpen] = useSidebarOpen(FEATURES_KEY)
  const [query, setQuery] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const current = locate(path).variant

  // ⌘K opened the sidebar (see `useSidebarsShortcut`): put the cursor in the search once it renders.
  useEffect(() => {
    const focus = () => requestAnimationFrame(() => input.current?.focus())
    window.addEventListener(FOCUS_FEATURE_SEARCH, focus)
    return () => window.removeEventListener(FOCUS_FEATURE_SEARCH, focus)
  }, [])

  if (!isOpen) return null

  const results = search(query)
  const groups = sections
    .map((section) => {
      const rows = results.filter((r) => r.feature.section === section.slug)
      const cards = [...new Set(rows.map((r) => r.feature))].map((feature) => ({
        feature,
        rows: rows.filter((r) => r.feature === feature),
      }))
      return { section, cards }
    })
    .filter((g) => g.cards.length > 0)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b pr-2 pl-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Features
          <Kbd>{SIDEBARS_SHORTCUT}</Kbd>
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide Features"
          title={`Hide Features (⌘K)`}
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelLeftCloseIcon className="size-5" />
        </button>
      </header>

      <div className="shrink-0 px-4 pt-4 pb-2">
        <InputGroup className="h-9 rounded-xl">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            ref={input}
            type="search"
            placeholder="Search features"
            aria-label="Search features"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter opens the first match; Escape clears the search.
              if (e.key === "Enter" && results[0]) onNavigate(results[0].variant.href)
              else if (e.key === "Escape") setQuery("")
            }}
          />
          <InputGroupAddon align="inline-end">
            <Kbd>⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <nav aria-label="Features" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
        ) : (
          groups.map(({ section, cards }) => (
            <section key={section.slug} className="pt-4">
              <h3 className="px-3 pb-1.5 text-lg font-bold tracking-tight">{section.title}</h3>
              <ul className="flex flex-col gap-0.5">
                {cards.map(({ feature, rows }) => (
                  <li key={feature.slug}>
                    <FeatureItem rows={rows} currentHref={current.href} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>
    </aside>
  )
}

/**
 * A feature: its icon and name (opening its first version) — and with more than one version, each
 * version under it. A single version's status shows beside the name instead.
 */
function FeatureItem({
  rows,
  currentHref,
  onNavigate,
}: {
  rows: Result[]
  currentHref: string
  onNavigate: (path: string) => void
}) {
  const { feature } = rows[0]
  const isCurrent = rows.some((r) => r.variant.href === currentHref)
  const single = rows.length === 1 ? rows[0].variant : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => onNavigate(rows[0].variant.href)}
        aria-current={single && isCurrent ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
          isCurrent && "bg-muted font-medium",
        )}
      >
        <CategoryIcon icon={feature.icon} size="sm" className="size-7 [&_svg]:size-3.5" />
        <span className="min-w-0 flex-1 truncate">{feature.title}</span>
        {single ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {single.title}
            <span className={cn("size-1.5 rounded-full", statusStyles[single.status ?? "ideation"].dot)} />
          </span>
        ) : null}
      </button>
      {single ? null : (
        <ul className="flex flex-col gap-0.5 py-0.5 pl-11">
          {rows.map(({ variant }) => (
            <li key={variant.href}>
              <button
                type="button"
                onClick={() => onNavigate(variant.href)}
                aria-current={variant.href === currentHref ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  variant.href === currentHref && "bg-muted text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{variant.title}</span>
                <span className={cn("size-1.5 rounded-full", statusStyles[variant.status ?? "ideation"].dot)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Reopens the collapsed sidebar — sits in the workbench toolbar. Renders nothing while it's open. */
export function FeatureSidebarToggle({ className }: { className?: string }) {
  const [isOpen, setOpen] = useSidebarOpen(FEATURES_KEY)
  if (isOpen) return null
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Show Features"
      title={`Show Features (⌘K)`}
      className={cn("justify-center transition-colors hover:bg-muted", className)}
    >
      <PanelLeftOpenIcon className="size-5" />
    </button>
  )
}
