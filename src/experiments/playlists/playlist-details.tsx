"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { formatDuration } from "@/experiments/albums/album-details"
import { DetailsPage } from "@/experiments/shared/details-page"
import { SongRow } from "@/experiments/songs/songs-screen"
import { artworkURL, fetchPlaylistSongs, setFavorite, type Playlist, type Session, type Song } from "@/lib/jellyfin"

// Mirrors `PlaylistFeature` in redfin-swift — the playlist's songs in order — under the album and
// artist pages' header (`DetailsPage`): art, name, "N songs · duration", Play / Shuffle / favorite.
// Rows are numbered by playlist position. Playback isn't prototyped yet.

type Load = { status: "loading" } | { status: "loaded"; songs: Song[] } | { status: "failed"; message: string }

/** "111 songs · 8:49:40", skipping whichever piece is missing (as the Swift `PlaylistRow`). */
export function playlistSummary(playlist: Playlist) {
  const count = playlist.childCount
  return [
    count !== undefined ? `${count} ${count === 1 ? "song" : "songs"}` : undefined,
    playlist.duration ? formatDuration(playlist.duration) : undefined,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function PlaylistDetails({
  playlist,
  session,
  backLabel,
  onBack,
  onPlaylistChange,
}: {
  playlist: Playlist
  session: Session
  /** Where "back" goes — "Playlists" when pushed from All Playlists; none when opened from the sidebar. */
  backLabel?: string
  onBack?: () => void
  /** The playlist changed here (favorited), so the list can keep its copy in step. */
  onPlaylistChange: (playlist: Playlist) => void
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" })

  useEffect(() => {
    const controller = new AbortController()
    fetchPlaylistSongs(session, playlist.id, controller.signal)
      .then((songs) => setLoad({ status: "loaded", songs }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, playlist.id])

  // Optimistic, like the Swift reducers: flip now, flip back if the server says no.
  const toggleFavorite = () => {
    const isFavorite = !playlist.isFavorite
    onPlaylistChange({ ...playlist, isFavorite })
    setFavorite(session, playlist.id, isFavorite).catch(() =>
      onPlaylistChange({ ...playlist, isFavorite: !isFavorite }),
    )
  }

  return (
    <DetailsPage
      art={artworkURL(session, playlist, 600)}
      title={playlist.name}
      meta={playlistSummary(playlist)}
      isFavorite={playlist.isFavorite}
      onToggleFavorite={toggleFavorite}
      backLabel={backLabel}
      onBack={onBack}
    >
      {load.status === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : load.status === "failed" ? (
        <p className="px-8 py-16 text-center text-sm text-muted-foreground">{load.message}</p>
      ) : load.songs.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground md:px-8">This playlist is empty.</p>
      ) : (
        <ol className="px-2 pb-8 md:px-6">
          {load.songs.map((song, i) => (
            <li key={`${song.id}:${i}`} className="[contain-intrinsic-size:auto_72px] [content-visibility:auto]">
              <SongRow song={song} session={session} number={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </DetailsPage>
  )
}
