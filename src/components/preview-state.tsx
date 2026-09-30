"use client"

import { useEffect, useState } from "react"
import { CheckIcon, LogInIcon, LogOutIcon, PanelRightCloseIcon, PanelRightOpenIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PREVIEW_STATE_KEY, SIDEBARS_SHORTCUT, useSidebarOpen } from "@/components/sidebars"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import type { Variant } from "@/experiments/registry"
import {
  fetchAlbums,
  fetchArtists,
  fetchGenres,
  fetchPlaylists,
  saveSession,
  setPreview,
  signOut,
  usePreview,
  useSelectedLibrary,
  useSession,
  type Item,
  type PreviewKind,
} from "@/lib/jellyfin"
import { cn } from "@/lib/utils"

// The workbench's collapsible right-hand "Preview State" panel: settings for what the devices show on
// the current page. On a details page that's which artist (or album) it opens — picked from the
// signed-in server's selected library, saved (see `usePreview`) so it survives reloads, and applied
// to the device frames as soon as it changes.

const copy: Record<PreviewKind, { title: string; noun: string }> = {
  artist: { title: "Artist", noun: "artists" },
  album: { title: "Album", noun: "albums" },
  genre: { title: "Genre", noun: "genres" },
  playlist: { title: "Playlist", noun: "playlists" },
}

/** The docked panel: the window's full height along its right edge. Renders nothing while collapsed. */
export function PreviewState({ variant, onNavigate }: { variant: Variant; onNavigate: (path: string) => void }) {
  const [isOpen, setOpen] = useSidebarOpen(PREVIEW_STATE_KEY)
  if (!isOpen) return null

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b pr-2 pl-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Preview State
          <Kbd>{SIDEBARS_SHORTCUT}</Kbd>
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide Preview State"
          title={`Hide Preview State (${SIDEBARS_SHORTCUT})`}
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightCloseIcon className="size-5" />
        </button>
      </header>
      {variant.preview ? (
        <PreviewPicker key={variant.preview} kind={variant.preview} />
      ) : (
        <p className="flex-1 p-5 text-sm text-muted-foreground">
          Nothing to set on this page. Details pages let you choose the artist, album, genre, or playlist they open.
        </p>
      )}
      <Account onNavigate={onNavigate} />
    </aside>
  )
}

/** Reopens the collapsed panel — sits in the workbench toolbar. Renders nothing while it's open. */
export function PreviewStateToggle({ className }: { className?: string }) {
  const [isOpen, setOpen] = useSidebarOpen(PREVIEW_STATE_KEY)
  if (isOpen) return null
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Show Preview State"
      title={`Show Preview State (${SIDEBARS_SHORTCUT})`}
      className={cn("justify-center transition-colors hover:bg-muted", className)}
    >
      <PanelRightOpenIcon className="size-5" />
    </button>
  )
}

/**
 * Who the devices are signed in as, on every page — with Sign Out, or a way to the sign-in screen.
 * (The Authentication page itself always shows the sign-in form, so this is where the account lives.)
 */
function Account({ onNavigate }: { onNavigate: (path: string) => void }) {
  const session = useSession()
  if (session === undefined) return null

  return (
    <section className="flex shrink-0 flex-col gap-3 border-t p-5">
      <h3 className="text-sm font-medium">Account</h3>
      {session ? (
        <>
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{session.username}</p>
            <p className="truncate text-xs text-muted-foreground">{session.serverName ?? session.serverURL}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void signOut(session)
              saveSession(null)
            }}
          >
            <LogOutIcon />
            Sign Out
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Not signed in.</p>
          <Button variant="outline" onClick={() => onNavigate("/authentication/live")}>
            <LogInIcon />
            Sign In
          </Button>
        </>
      )}
    </section>
  )
}

/** Which item the page opens: a searchable list, with the pick checked. */
function PreviewPicker({ kind }: { kind: PreviewKind }) {
  const session = useSession()
  const library = useSelectedLibrary()
  const preview = usePreview(kind)
  const [search, setSearch] = useState("")
  // Keyed by what was fetched, so a new account or library never shows the old list.
  const [loaded, setLoaded] = useState<{ key: string; items: Item[] }>()
  const key = `${kind}:${session?.accessToken}:${library?.id}`
  const items = loaded?.key === key ? loaded.items : undefined

  useEffect(() => {
    if (!session || library === undefined) return
    const controller = new AbortController()
    const request =
      kind === "artist"
        ? fetchArtists(session, library?.id, controller.signal)
        : kind === "genre"
          ? fetchGenres(session, library?.id, controller.signal)
          : kind === "playlist"
            ? fetchPlaylists(session, controller.signal)
            : fetchAlbums(session, { libraryID: library?.id }, controller.signal)
    request.then((items) => setLoaded({ key, items }), () => {})
    return () => controller.abort()
  }, [kind, session, library, key])

  const { title, noun } = copy[kind]
  // With nothing picked (or a pick from another library), the page shows the first item.
  const shownID = (items?.find((item) => item.id === preview?.id) ?? items?.[0])?.id
  const query = search.trim().toLocaleLowerCase()
  const filtered = items?.filter((item) => item.name.toLocaleLowerCase().includes(query))

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-5 pt-4 pb-3">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">The {kind} this page opens. Saved across reloads.</p>
        </div>
        <InputGroup className="h-9 rounded-xl">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={`Search ${noun}`}
            aria-label={`Search ${noun}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!items}
          />
        </InputGroup>
      </div>

      {!session ? (
        <p className="px-5 text-sm text-muted-foreground">Sign in to a Jellyfin server to choose one.</p>
      ) : !filtered ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-5 text-sm text-muted-foreground">{query ? "No matches." : `No ${noun}.`}</p>
      ) : (
        <ul role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.map((item) => {
            const isSelected = item.id === shownID
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setPreview(kind, item)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-muted",
                    isSelected && "font-medium",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {isSelected ? <CheckIcon className="size-4 shrink-0 text-red-500" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
