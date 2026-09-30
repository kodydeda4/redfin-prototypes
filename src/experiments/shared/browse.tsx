"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { SearchIcon, SearchXIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { ShellBackButton } from "@/experiments/sidebar/shell-back"
import { saveSession, usePreview, type Item, type PreviewKind } from "@/lib/jellyfin"

// The pieces every browse screen (Albums, Artists, …) shares: a large title with a search field, and
// the loading / signed-out / failed / empty states around its grid.

export type Load<T> =
  | { status: "loading" }
  | { status: "loaded"; items: T[] }
  | { status: "failed"; message: string }
  | { status: "expired" }

/**
 * On a details page (`enabled`), opens the item picked in the workbench's Preview menu — or the first,
 * if none is picked or it's not in this library — once `items` load, and again whenever the pick
 * changes. Going back to the grid sticks until then. Both device frames open the same item, so they
 * agree.
 */
export function useOpenPreview(
  kind: PreviewKind,
  enabled: boolean,
  items: Item[] | null,
  open: (id: string) => void,
) {
  const preview = usePreview(kind)
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !items || preview === undefined) return
    const target = items.find((item) => item.id === preview?.id) ?? items[0]
    if (!target || applied.current === target.id) return
    applied.current = target.id
    open(target.id)
  }, [enabled, items, preview, open])
}

/** Case-insensitive match of `query` against any of `fields`. */
export function matches(query: string, ...fields: (string | undefined)[]) {
  const q = query.trim().toLocaleLowerCase()
  return !q || fields.some((f) => f?.toLocaleLowerCase().includes(q))
}

export function BrowseHeader({
  title,
  search,
  onSearch,
  placeholder = title,
}: {
  title: string
  search: string
  onSearch: (value: string) => void
  /** The field's prompt — the title by default ("Albums" searches albums). */
  placeholder?: string
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 bg-background/80 px-4 pt-[calc(var(--safe-top)+0.75rem)] pb-3 backdrop-blur-xl">
      <ShellBackButton />
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <InputGroup className="h-9 rounded-xl border-transparent bg-muted dark:bg-muted">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder={placeholder}
          aria-label={placeholder === title ? `Search ${title.toLocaleLowerCase()}` : placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="text-base md:text-sm"
        />
      </InputGroup>
    </header>
  )
}

/**
 * What stands in for the grid (a plain function, called inline): a spinner, an error, or an empty state — or `null` when there are
 * results to show. `noun` is the plural shown in messages ("albums").
 */
export function browseStatus<T>({
  load,
  shown,
  search,
  noun,
  icon: Icon,
  onRetry,
}: {
  load: Load<T>
  /** The items left after the search filter. */
  shown: T[]
  search: string
  noun: string
  icon: LucideIcon
  onRetry: () => void
}): React.ReactNode {
  const title = noun[0].toLocaleUpperCase() + noun.slice(1)
  if (load.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }
  if (load.status === "expired") {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>Session Expired</EmptyTitle>
          <EmptyDescription>The server signed you out. Sign in again to see your {noun}.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/authentication/live" onClick={() => saveSession(null)} />}>
            Sign In
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (load.status === "failed") {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>Couldn&apos;t Load {title}</EmptyTitle>
          <EmptyDescription>{load.message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (shown.length > 0) return null
  const query = search.trim()
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">{query ? <SearchXIcon /> : <Icon />}</EmptyMedia>
        <EmptyTitle>{query ? "No Results" : `No ${title}`}</EmptyTitle>
        <EmptyDescription>
          {query ? `Nothing matches “${query}”.` : `This server's libraries don't have any ${noun} yet.`}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function SignedOut({ noun, icon: Icon }: { noun: string; icon: LucideIcon }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-(--safe-top)">
        <ShellBackButton />
      </div>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>Not Signed In</EmptyTitle>
          <EmptyDescription>Connect to your Jellyfin server to see your {noun}.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/authentication/live" />}>
            Sign In
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
