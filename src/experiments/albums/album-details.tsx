"use client"

import { useEffect, useState } from "react"
import { EllipsisIcon, StarIcon, StarOffIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { DetailsPage } from "@/experiments/shared/details-page"
import { artworkURL, fetchSongs, setFavorite, type Album, type Session, type Song } from "@/lib/jellyfin"

// Mirrors `iOSAlbumDetailsFeature` in redfin-swift, laid out like the macOS album page (`DetailsPage`):
// title / artist / genre · year over the track list (grouped by disc when there's more than one) and
// a song-count footer.
//
// Favorites are optimistic, like the Swift reducer: flip now, flip back if the server says no.
// Playback isn't prototyped yet, so the rows don't play anything.

type Load = { status: "loading" } | { status: "loaded"; songs: Song[] } | { status: "failed"; message: string }

export function AlbumDetails({
  album,
  session,
  backLabel = "Albums",
  onBack,
  onAlbumChange,
}: {
  album: Album
  session: Session
  /** The screen "back" returns to — "Albums", or the artist it was opened from. */
  backLabel?: string
  onBack: () => void
  /** The album changed here (favorited), so the grid can keep its copy in step. */
  onAlbumChange: (album: Album) => void
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" })

  useEffect(() => {
    const controller = new AbortController()
    fetchSongs(session, album.id, controller.signal)
      .then((songs) => setLoad({ status: "loaded", songs }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, album.id])

  const toggleAlbumFavorite = () => {
    const isFavorite = !album.isFavorite
    onAlbumChange({ ...album, isFavorite })
    setFavorite(session, album.id, isFavorite).catch(() => onAlbumChange({ ...album, isFavorite: !isFavorite }))
  }

  const setSongFavorite = (id: string, isFavorite: boolean) =>
    setLoad((load) =>
      load.status === "loaded"
        ? { ...load, songs: load.songs.map((s) => (s.id === id ? { ...s, isFavorite } : s)) }
        : load,
    )

  const toggleSongFavorite = (song: Song) => {
    const isFavorite = !song.isFavorite
    setSongFavorite(song.id, isFavorite)
    setFavorite(session, song.id, isFavorite).catch(() => setSongFavorite(song.id, !isFavorite))
  }

  const meta = [album.genres[0], album.productionYear].filter(Boolean).join(" · ")

  return (
    <DetailsPage
      art={artworkURL(session, album, 600)}
      title={album.name}
      subtitle={album.albumArtist}
      meta={meta}
      isFavorite={album.isFavorite}
      onToggleFavorite={toggleAlbumFavorite}
      backLabel={backLabel}
      onBack={onBack}
    >
      {load.status === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : load.status === "failed" ? (
        <p className="px-8 py-16 text-center text-sm text-muted-foreground">{load.message}</p>
      ) : (
        <TrackList songs={load.songs} onToggleFavorite={toggleSongFavorite} />
      )}
    </DetailsPage>
  )
}

function TrackList({ songs, onToggleFavorite }: { songs: Song[]; onToggleFavorite: (song: Song) => void }) {
  const discs = groupByDisc(songs)
  return (
    <div className="px-2 pb-8 md:px-6">
      {discs.map((disc) => (
        <section key={disc.number ?? 0}>
          {disc.number !== null ? (
            <h2 className="px-4 pt-6 pb-2 text-sm font-semibold text-muted-foreground">Disc {disc.number}</h2>
          ) : null}
          <ol>
            {disc.songs.map((song) => (
              <li key={song.id}>
                <SongRow song={song} onToggleFavorite={() => onToggleFavorite(song)} />
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="px-4 pt-4 text-sm text-muted-foreground">{footer(songs)}</p>
    </div>
  )
}

function SongRow({ song, onToggleFavorite }: { song: Song; onToggleFavorite: () => void }) {
  return (
    <div className="flex h-12 items-center rounded-lg pr-1 transition-colors hover:bg-foreground/5">
      {/* A filled star flags a favorite, in a gutter left of the track number (as in the iOS app). */}
      <span className="flex w-4 shrink-0 justify-center text-muted-foreground">
        {song.isFavorite ? <StarIcon className="size-2.5 fill-current" aria-label="Favorite" /> : null}
      </span>
      <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
        {song.indexNumber ?? "–"}
      </span>
      {/* The divider starts at the title, leaving the star and number in the margin. */}
      <div className="ml-4 flex h-full min-w-0 flex-1 items-center gap-3 border-b border-border/60">
        <span className="min-w-0 flex-1 truncate">{song.name}</span>
        {song.duration !== undefined ? (
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More for ${song.name}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10"
          >
            <EllipsisIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onToggleFavorite}>
              {song.isFavorite ? <StarOffIcon /> : <StarIcon />}
              {song.isFavorite ? "Undo Favorite" : "Favorite"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** One disc's tracks. `number` is `null` for single-disc albums, which show no "Disc N" header. */
function groupByDisc(songs: Song[]): { number: number | null; songs: Song[] }[] {
  const byDisc = new Map<number, Song[]>()
  for (const song of songs) {
    const disc = song.parentIndexNumber ?? 1
    byDisc.set(disc, [...(byDisc.get(disc) ?? []), song])
  }
  if (byDisc.size <= 1) return [{ number: null, songs }]
  return [...byDisc.keys()]
    .sort((a, b) => a - b)
    .map((number) => ({
      number,
      songs: byDisc.get(number)!.sort((a, b) => (a.indexNumber ?? 0) - (b.indexNumber ?? 0)),
    }))
}

/** "3:58", or "8:49:40" once it runs an hour or more. */
export function formatDuration(seconds: number) {
  const s = Math.round(seconds)
  const pad = (n: number) => String(n).padStart(2, "0")
  if (s >= 3600) return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}

/** "15 songs, 1 hour 18 minutes" — the duration's left off until it's known. */
function footer(songs: Song[]) {
  const parts = [`${songs.length} song${songs.length === 1 ? "" : "s"}`]
  const totalMinutes = Math.floor(songs.reduce((sum, s) => sum + (s.duration ?? 0), 0) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const duration = [
    hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : null,
    minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : null,
  ].filter(Boolean)
  if (duration.length > 0) parts.push(duration.join(" "))
  return parts.join(", ")
}
