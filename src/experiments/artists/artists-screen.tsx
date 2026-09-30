"use client"

import { useEffect, useState } from "react"
import { MicVocalIcon } from "lucide-react"

import { ArtistDetails } from "@/experiments/artists/artist-details"
import { BrowseHeader, browseStatus, matches, SignedOut, useOpenPreview, type Load } from "@/experiments/shared/browse"
import { Artwork } from "@/experiments/shared/details-page"
import {
  artworkURL,
  fetchArtists,
  SessionExpiredError,
  useSelectedLibrary,
  useSession,
  type Artist,
  type Session,
} from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `iOSArtistsFeature` in redfin-swift: every artist in the library at once, in a grid with
// the name centered under each picture — round on iPhone (the iOS app), rounded squares on iPad (the
// macOS app) — with a name search.

/** The Artists screen on its own, filling (and scrolling within) its parent — the sidebar embeds it. */
export function ArtistsScreen({ openPreview = false }: { openPreview?: boolean }) {
  const session = useSession()
  const library = useSelectedLibrary()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {session === undefined || library === undefined ? null : session ? (
        // Keyed so switching account or library starts a fresh load.
        <Artists
          key={`${session.accessToken}:${library?.id}`}
          session={session}
          libraryID={library?.id}
          openPreview={openPreview}
        />
      ) : (
        <SignedOut noun="artists" icon={MicVocalIcon} />
      )}
    </div>
  )
}

function Artists({
  session,
  libraryID,
  openPreview,
}: {
  session: Session
  libraryID?: string
  openPreview: boolean
}) {
  const [load, setLoad] = useState<Load<Artist>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  // Shared by both device frames, so searching or opening an artist on either shows on both.
  const [search, setSearch] = useSynced("artists-search", "")
  // The artist pushed over the grid. The grid stays mounted underneath, keeping its scroll position.
  const [openID, setOpenID] = useSynced<string | null>("artists-open", null)
  useEffect(() => {
    const controller = new AbortController()
    fetchArtists(session, libraryID, controller.signal)
      .then((items) => setLoad({ status: "loaded", items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof SessionExpiredError) return setLoad({ status: "expired" })
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, libraryID, attempt])

  // Artist Details Live opens the artist picked in the workbench's Preview menu (or the first).
  useOpenPreview("artist", openPreview, load.status === "loaded" ? load.items : null, setOpenID)

  const retry = () => {
    setLoad({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  const artists = load.status === "loaded" ? load.items : []
  const open = artists.find((a) => a.id === openID)
  const shown = artists.filter((a) => matches(search, a.name))

  const updateArtist = (artist: Artist) =>
    setLoad((load) =>
      load.status === "loaded" ? { ...load, items: load.items.map((a) => (a.id === artist.id ? artist : a)) } : load,
    )

  return (
    <>
      <div
        data-covered={open ? true : undefined}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-(--safe-bottom) data-covered:hidden"
      >
        <BrowseHeader title="Artists" search={search} onSearch={setSearch} />
        {browseStatus({ load, shown, search, noun: "artists", icon: MicVocalIcon, onRetry: retry }) ?? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 px-4 pt-1 pb-6">
            {shown.map((artist) => (
              <li key={artist.id}>
                <button
                  type="button"
                  onClick={() => setOpenID(artist.id)}
                  className="flex w-full min-w-0 flex-col items-center gap-2 active:opacity-70"
                >
                  <Artwork src={artworkURL(session, artist, 400)} className="w-full rounded-full md:rounded-lg" />
                  <p className="w-full truncate text-center text-sm font-medium">{artist.name}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Always rendered, after the grid, so opening an artist never shifts the grid's elements — the
          workbench finds the elements for replayed taps by their position. */}
      <div className="contents">
        {open ? (
          <ArtistDetails artist={open} session={session} onBack={() => setOpenID(null)} onArtistChange={updateArtist} />
        ) : null}
      </div>
    </>
  )
}
