"use client"

import { useEffect, useState } from "react"
import { GuitarIcon } from "lucide-react"

import { GenreDetails } from "@/experiments/genres/genre-details"
import { BrowseHeader, browseStatus, matches, SignedOut, useOpenPreview, type Load } from "@/experiments/shared/browse"
import { Artwork } from "@/experiments/shared/details-page"
import {
  artworkURL,
  fetchGenres,
  SessionExpiredError,
  useSelectedLibrary,
  useSession,
  type Genre,
  type Session,
} from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `GenresFeature` in redfin-swift: the library's genres, alphabetical, each with its picture
// (Jellyfin's collage of the genre's albums) and item count, and a name search. Tapping one pushes
// its details.

/** The Genres screen on its own, filling (and scrolling within) its parent — the sidebar embeds it. */
export function GenresScreen({ openPreview = false }: { openPreview?: boolean }) {
  const session = useSession()
  const library = useSelectedLibrary()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {session === undefined || library === undefined ? null : session ? (
        // Keyed so switching account or library starts a fresh load.
        <Genres
          key={`${session.accessToken}:${library?.id}`}
          session={session}
          libraryID={library?.id}
          openPreview={openPreview}
        />
      ) : (
        <SignedOut noun="genres" icon={GuitarIcon} />
      )}
    </div>
  )
}

function Genres({ session, libraryID, openPreview }: { session: Session; libraryID?: string; openPreview: boolean }) {
  const [load, setLoad] = useState<Load<Genre>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  // Shared by both device frames, so searching or opening a genre on either shows on both.
  const [search, setSearch] = useSynced("genres-search", "")
  // The genre pushed over the list. The list stays mounted underneath, keeping its scroll position.
  const [openID, setOpenID] = useSynced<string | null>("genres-open", null)

  useEffect(() => {
    const controller = new AbortController()
    fetchGenres(session, libraryID, controller.signal)
      .then((items) => setLoad({ status: "loaded", items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof SessionExpiredError) return setLoad({ status: "expired" })
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, libraryID, attempt])

  // Genre Details Live opens the genre picked in the workbench's Preview State (or the first).
  useOpenPreview("genre", openPreview, load.status === "loaded" ? load.items : null, setOpenID)

  const retry = () => {
    setLoad({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  const genres = load.status === "loaded" ? load.items : []
  const open = genres.find((g) => g.id === openID)
  const shown = genres.filter((g) => matches(search, g.name))

  return (
    <>
      <div
        data-covered={open ? true : undefined}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-(--safe-bottom) data-covered:hidden"
      >
        <BrowseHeader title="Genres" search={search} onSearch={setSearch} />
        {browseStatus({ load, shown, search, noun: "genres", icon: GuitarIcon, onRetry: retry }) ?? (
          <ul className="px-2 pb-6 md:px-4">
            {shown.map((genre) => (
              <li key={genre.id}>
                <button
                  type="button"
                  onClick={() => setOpenID(genre.id)}
                  className="flex w-full items-center gap-3 rounded-lg py-2 pr-2 pl-2 text-left transition-colors hover:bg-foreground/5 active:opacity-70"
                >
                  <Artwork src={artworkURL(session, genre, 120)} className="size-14 shrink-0 rounded-md" />
                  <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center border-b border-border/60">
                    <p className="truncate text-[15px] font-medium">{genre.name}</p>
                    {genre.childCount !== undefined ? (
                      <p className="text-xs text-muted-foreground">
                        {genre.childCount} {genre.childCount === 1 ? "item" : "items"}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Always rendered, after the list, so opening a genre never shifts the list's elements — the
          workbench finds the elements for replayed taps by their position. */}
      <div className="contents">
        {open ? (
          <GenreDetails genre={open} session={session} libraryID={libraryID} onBack={() => setOpenID(null)} />
        ) : null}
      </div>
    </>
  )
}
