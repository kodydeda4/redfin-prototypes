"use client"

import { useEffect, useState } from "react"
import { MusicIcon } from "lucide-react"

import { formatDuration } from "@/experiments/albums/album-details"
import { BrowseHeader, browseStatus, matches, SignedOut, type Load } from "@/experiments/shared/browse"
import { Artwork } from "@/experiments/shared/details-page"
import {
  fetchLibrarySongs,
  SessionExpiredError,
  songArtworkURL,
  useSelectedLibrary,
  useSession,
  type Session,
  type Song,
} from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `SongsFeature` in redfin-swift: every song in the library, grouped by artist then album in
// track order, with a title search. Each row: track number, album art, title, "Album · Artist", year,
// and length. Playback isn't prototyped yet, so rows don't play anything.

/** The Songs screen on its own, filling (and scrolling within) its parent — the sidebar embeds it. */
export function SongsScreen() {
  const session = useSession()
  const library = useSelectedLibrary()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {session === undefined || library === undefined ? null : session ? (
        // Keyed so switching account or library starts a fresh load.
        <Songs key={`${session.accessToken}:${library?.id}`} session={session} libraryID={library?.id} />
      ) : (
        <SignedOut noun="songs" icon={MusicIcon} />
      )}
    </div>
  )
}

function Songs({ session, libraryID }: { session: Session; libraryID?: string }) {
  const [load, setLoad] = useState<Load<Song>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  // Shared by both device frames, so searching on either shows on both.
  const [search, setSearch] = useSynced("songs-search", "")

  useEffect(() => {
    const controller = new AbortController()
    fetchLibrarySongs(session, libraryID, controller.signal)
      .then((items) => setLoad({ status: "loaded", items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof SessionExpiredError) return setLoad({ status: "expired" })
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, libraryID, attempt])

  const retry = () => {
    setLoad({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  const songs = load.status === "loaded" ? load.items : []
  const shown = songs.filter((s) => matches(search, s.name))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-(--safe-bottom)">
      <BrowseHeader title="Songs" search={search} onSearch={setSearch} />
      {browseStatus({ load, shown, search, noun: "songs", icon: MusicIcon, onRetry: retry }) ?? (
        <ol className="px-2 pb-6 md:px-4">
          {shown.map((song) => (
            <li
              key={song.id}
              // Libraries can hold thousands of songs; skip laying out rows until they near the screen.
              className="[contain-intrinsic-size:auto_72px] [content-visibility:auto]"
            >
              <SongRow song={song} session={session} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** A song in a list: number, art, title, "Album · Artist", year, and length. */
export function SongRow({
  song,
  session,
  number = song.album ? song.indexNumber : undefined,
}: {
  song: Song
  session: Session
  /** The gutter number — the track number by default (none outside an album); a playlist's position. */
  number?: number
}) {
  const subtitle = [song.album, song.albumArtist].filter(Boolean).join(" · ")
  return (
    <div className="flex items-start gap-3 rounded-lg py-2 pr-2 transition-colors hover:bg-foreground/5">
      <span className="w-6 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{number}</span>
      <Artwork src={songArtworkURL(session, song, 120)} className="size-12 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 items-start gap-3 border-b border-border/60 pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{song.name}</p>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          {song.productionYear ? <p className="text-xs text-muted-foreground/70">{song.productionYear}</p> : null}
        </div>
        {song.duration !== undefined ? (
          <span className="shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">
            {formatDuration(song.duration)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
