"use client"

import { useEffect, useState } from "react"
import { DiscAlbumIcon } from "lucide-react"

import { AlbumDetails } from "@/experiments/albums/album-details"
import { BrowseHeader, browseStatus, matches, SignedOut, useOpenPreview, type Load } from "@/experiments/shared/browse"
import { Artwork } from "@/experiments/shared/details-page"
import {
  artworkURL,
  fetchAlbums,
  SessionExpiredError,
  useSelectedLibrary,
  useSession,
  type Album,
  type Session,
} from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `iOSAlbumsFeature` in redfin-swift: every album at once in a grid of square covers, with a
// search that matches album name or artist. With `recentlyAdded` it's the Recently Added screen
// instead (`RecentlyAddedFeature`): the 20 newest additions to the server, newest first.

/** How many albums Recently Added shows, as in the Swift app. */
const RECENTLY_ADDED_COUNT = 20

/** The Albums screen on its own, filling (and scrolling within) its parent — the sidebar embeds it. */
export function AlbumsScreen({
  openPreview = false,
  recentlyAdded = false,
}: {
  openPreview?: boolean
  recentlyAdded?: boolean
}) {
  const session = useSession()
  const library = useSelectedLibrary()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {session === undefined || library === undefined ? null : session ? (
        // Keyed so switching account or library starts a fresh load.
        <Albums
          key={`${session.accessToken}:${library?.id}`}
          session={session}
          libraryID={library?.id}
          openPreview={openPreview}
          recentlyAdded={recentlyAdded}
        />
      ) : (
        <SignedOut noun="albums" icon={DiscAlbumIcon} />
      )}
    </div>
  )
}

function Albums({
  session,
  libraryID,
  openPreview,
  recentlyAdded,
}: {
  session: Session
  libraryID?: string
  openPreview: boolean
  recentlyAdded: boolean
}) {
  const title = recentlyAdded ? "Recently Added" : "Albums"
  // Separate synced state per screen, so Recently Added and Albums don't share a search or open album.
  const syncPrefix = recentlyAdded ? "recent" : "albums"
  const [load, setLoad] = useState<Load<Album>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  // Shared by both device frames, so searching or opening an album on either shows on both.
  const [search, setSearch] = useSynced(`${syncPrefix}-search`, "")
  // The album pushed over the grid. The grid stays mounted underneath, keeping its scroll position.
  const [openID, setOpenID] = useSynced<string | null>(`${syncPrefix}-open`, null)
  useEffect(() => {
    const controller = new AbortController()
    fetchAlbums(session, { libraryID, newest: recentlyAdded ? RECENTLY_ADDED_COUNT : undefined }, controller.signal)
      .then((items) => setLoad({ status: "loaded", items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof SessionExpiredError) return setLoad({ status: "expired" })
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, libraryID, recentlyAdded, attempt])

  // Album Details Live opens the album picked in the workbench's Preview menu (or the first).
  useOpenPreview("album", openPreview, load.status === "loaded" ? load.items : null, setOpenID)

  const retry = () => {
    setLoad({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  const albums = load.status === "loaded" ? load.items : []
  const open = albums.find((a) => a.id === openID)
  const shown = albums.filter((a) => matches(search, a.name, a.albumArtist))

  const updateAlbum = (album: Album) =>
    setLoad((load) =>
      load.status === "loaded" ? { ...load, items: load.items.map((a) => (a.id === album.id ? album : a)) } : load,
    )

  return (
    <>
      <div
        data-covered={open ? true : undefined}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-(--safe-bottom) data-covered:hidden"
      >
        <BrowseHeader title={title} search={search} onSearch={setSearch} />
        {browseStatus({ load, shown, search, noun: "albums", icon: DiscAlbumIcon, onRetry: retry }) ?? (
          <AlbumGrid albums={shown} session={session} onOpen={(album) => setOpenID(album.id)} />
        )}
      </div>
      {/* Always rendered, after the grid, so opening an album never shifts the grid's elements — the
          workbench finds the elements for replayed taps by their position. */}
      <div className="contents">
        {open ? (
          <AlbumDetails
            album={open}
            session={session}
            backLabel={title}
            onBack={() => setOpenID(null)}
            onAlbumChange={updateAlbum}
          />
        ) : null}
      </div>
    </>
  )
}

/** Two square columns on iPhone, more as the width allows (iPad). */
export function AlbumGrid({
  albums,
  session,
  detail = (album) => album.albumArtist,
  onOpen,
}: {
  albums: Album[]
  session: Session
  /** Each cell's second line — the artist by default. */
  detail?: (album: Album) => string | number | undefined
  onOpen: (album: Album) => void
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 px-4 pt-1 pb-6">
      {albums.map((album) => (
        <li key={album.id}>
          <button
            type="button"
            onClick={() => onOpen(album)}
            className="flex w-full min-w-0 flex-col gap-1.5 text-left active:opacity-70"
          >
            {/* 2× the largest cell for sharp art on retina screens. */}
            <Artwork src={artworkURL(session, album, 400)} className="rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{album.name}</p>
              {detail(album) ? <p className="truncate text-xs text-muted-foreground">{detail(album)}</p> : null}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
