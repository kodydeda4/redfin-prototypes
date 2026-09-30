"use client"

import { useStored, writeStored } from "@/lib/stored"

// The Jellyfin client shared by every Redfin prototype: sign-in, the saved session, and the
// library requests (mirrors `JellyfinClient` in redfin-swift).

const SESSION_KEY = "redfin:jellyfin-session"
const DEVICE_ID_KEY = "redfin:device-id"

export type Session = {
  serverURL: string
  serverName?: string
  userID: string
  username: string
  accessToken: string
  /** When this session was saved (ms since epoch); lets a concurrent sign-in reuse it. */
  signedInAt?: number
}

function deviceID() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/** Jellyfin identifies every client through this header, signed in or not. */
export function authorization(token?: string) {
  const fields = { Client: "Redfin", Device: "Web", DeviceId: deviceID(), Version: "1.0.0", Token: token }
  const pairs = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}="${encodeURIComponent(v!)}"`)
  return `MediaBrowser ${pairs.join(", ")}`
}

/** Accepts `jellyfin.example.com` as well as full URLs; drops any trailing slash. */
function normalizeServerURL(raw: string): URL {
  const trimmed = raw.trim()
  const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  url.pathname = url.pathname.replace(/\/+$/, "")
  return url
}

/**
 * Signs in, one frame at a time. Jellyfin revokes a device's existing tokens whenever it signs in
 * again, and every workbench frame shares one device ID — so when the "Both" layout mirrors a Connect
 * tap, two parallel sign-ins would cancel each other's token. Instead, the second frame waits its turn
 * and reuses the session the first one just saved.
 */
export async function authenticate(serverURL: string, username: string, password: string): Promise<Session> {
  let base: URL
  try {
    base = normalizeServerURL(serverURL)
  } catch {
    throw new Error("The server URL isn't valid.")
  }
  const root = base.href.replace(/\/$/, "")
  const startedAt = Date.now()

  const signIn = async () => {
    const saved = parseSession(localStorage.getItem(SESSION_KEY))
    const isFresh =
      saved &&
      saved.serverURL === root &&
      saved.username.toLocaleLowerCase() === username.toLocaleLowerCase() &&
      (saved.signedInAt ?? 0) >= startedAt
    if (isFresh) return saved
    const session = await requestSession(root, username, password)
    saveSession(session) // Before releasing the lock, so the next frame in line finds it.
    return session
  }
  // Web Locks are shared by same-origin frames; they're missing outside secure contexts (e.g. a phone
  // on the LAN over http), where there's only one frame to worry about anyway.
  return navigator.locks ? navigator.locks.request("redfin:sign-in", signIn) : signIn()
}

async function requestSession(root: string, username: string, password: string): Promise<Session> {
  let response: Response
  try {
    response = await fetch(`${root}/Users/AuthenticateByName`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization() },
      body: JSON.stringify({ Username: username, Pw: password }),
      // Small JSON payload — a request stalled this long has hung, not slowed.
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The server took too long to respond.")
    }
    throw new Error("Couldn't reach the server. Check the URL and that it allows requests from this site.")
  }

  if (response.status === 401) throw new Error("The username or password is incorrect.")
  if (!response.ok) throw new Error(`The server responded with an error (${response.status}).`)

  const result = (await response.json()) as { AccessToken?: string; User?: { Id?: string; Name?: string } }
  if (!result.AccessToken || !result.User?.Id) throw new Error("The server didn't return a session.")

  // Best-effort, for the signed-in chrome: a server that doesn't answer this shouldn't fail sign-in.
  const info = await fetch(`${root}/System/Info/Public`)
    .then((r) => (r.ok ? (r.json() as Promise<{ ServerName?: string }>) : undefined))
    .catch(() => undefined)

  return {
    serverURL: root,
    serverName: info?.ServerName,
    userID: result.User.Id,
    username: result.User.Name ?? username,
    accessToken: result.AccessToken,
    signedInAt: Date.now(),
  }
}

export async function signOut(session: Session) {
  await fetch(`${session.serverURL}/Sessions/Logout`, {
    method: "POST",
    headers: { Authorization: authorization(session.accessToken) },
  }).catch(() => {})
}

// The saved session lives in localStorage, so every device frame (and tab) shares one sign-in.
export function saveSession(session: Session | null) {
  writeStored(SESSION_KEY, session)
}

function parseSession(raw: string | null): Session | null {
  try {
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

/** `undefined` until hydrated, so the server render doesn't flash the form for a signed-in user. */
export function useSession() {
  return useStored<Session>(SESSION_KEY)
}

// ---- Library ---------------------------------------------------------------

/** The server rejected the saved token (revoked, or signed out elsewhere). */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Sign in again.")
    this.name = "SessionExpiredError"
  }
}

/** A library, playlist, or other named item — enough to list and link it. */
export type Item = { id: string; name: string }

export type Album = Item & {
  albumArtist?: string
  primaryImageTag?: string
  productionYear?: number
  genres: string[]
  isFavorite: boolean
}

export type Song = Item & {
  /** Track number within its disc. */
  indexNumber?: number
  /** Disc number. */
  parentIndexNumber?: number
  /** Length in seconds. */
  duration?: number
  isFavorite: boolean
  album?: string
  albumID?: string
  albumArtist?: string
  productionYear?: number
  /** The song's own art — most songs have none and use their album's (see `songArtworkURL`). */
  primaryImageTag?: string
  albumPrimaryImageTag?: string
}

type RawItem = {
  Id: string
  Name: string
  AlbumArtist?: string
  CollectionType?: string
  ImageTags?: { Primary?: string }
  ProductionYear?: number
  Genres?: string[]
  IndexNumber?: number
  ParentIndexNumber?: number
  /** Jellyfin ticks: 10,000,000 per second. */
  RunTimeTicks?: number
  UserData?: { IsFavorite?: boolean }
  ChildCount?: number
  Album?: string
  AlbumId?: string
  AlbumPrimaryImageTag?: string
  Artists?: string[]
}

async function get<T>(session: Session, path: string, params: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(`${session.serverURL}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: authorization(session.accessToken) },
    signal,
  })
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new Error(`The server responded with an error (${response.status}).`)
  return (await response.json()) as T
}

/**
 * Albums (the Swift app's `fetchAlbums`): alphabetical across a library — just `libraryID`'s when set,
 * otherwise all of them — or in one genre; or, for one artist, oldest first.
 */
export async function fetchAlbums(
  session: Session,
  {
    libraryID,
    artistID,
    genreID,
    newest,
  }: {
    libraryID?: string
    artistID?: string
    genreID?: string
    /** Just the `newest` most recently added, newest first (the Swift app's `fetchRecentlyAdded`). */
    newest?: number
  },
  signal?: AbortSignal,
): Promise<Album[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    "/Items",
    {
      userId: session.userID,
      IncludeItemTypes: "MusicAlbum",
      Recursive: "true",
      // Recently added means when the server got it, not the release date.
      SortBy: newest ? "DateCreated" : artistID ? "PremiereDate,SortName" : "SortName",
      SortOrder: newest ? "Descending" : "Ascending",
      ...(newest ? { Limit: String(newest) } : {}),
      Fields: "Genres,ChildCount",
      EnableUserData: "true",
      ImageTypeLimit: "1",
      ...(libraryID ? { ParentId: libraryID } : {}),
      ...(artistID ? { AlbumArtistIds: artistID } : {}),
      ...(genreID ? { GenreIds: genreID } : {}),
    },
    signal,
  )
  return result.Items.map((item) => ({
    id: item.Id,
    name: item.Name,
    albumArtist: item.AlbumArtist || undefined,
    primaryImageTag: item.ImageTags?.Primary,
    productionYear: item.ProductionYear,
    genres: item.Genres ?? [],
    isFavorite: item.UserData?.IsFavorite ?? false,
  }))
}

export type Artist = Item & {
  primaryImageTag?: string
  genres: string[]
  isFavorite: boolean
}

/** Artists, alphabetical — in one library when `libraryID` is set (the Swift app's `fetchArtists`). */
export async function fetchArtists(session: Session, libraryID?: string, signal?: AbortSignal): Promise<Artist[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    "/Artists",
    {
      userId: session.userID,
      SortBy: "SortName",
      SortOrder: "Ascending",
      Fields: "Genres",
      EnableUserData: "true",
      EnableImageTypes: "Primary,Backdrop",
      ...(libraryID ? { ParentId: libraryID } : {}),
    },
    signal,
  )
  return result.Items.map((item) => ({
    id: item.Id,
    name: item.Name,
    primaryImageTag: item.ImageTags?.Primary,
    genres: item.Genres ?? [],
    isFavorite: item.UserData?.IsFavorite ?? false,
  }))
}

export type Genre = Item & {
  primaryImageTag?: string
  /** How many items the genre spans. */
  childCount?: number
}

/** The library's genres, alphabetical (the Swift app's `fetchAllGenresInLibrary`). */
export async function fetchGenres(session: Session, libraryID?: string, signal?: AbortSignal): Promise<Genre[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    "/MusicGenres",
    {
      userId: session.userID,
      SortBy: "SortName",
      SortOrder: "Ascending",
      Fields: "ChildCount",
      ...(libraryID ? { ParentId: libraryID } : {}),
    },
    signal,
  )
  return result.Items.map((item) => ({
    id: item.Id,
    name: item.Name,
    primaryImageTag: item.ImageTags?.Primary,
    childCount: item.ChildCount,
  }))
}

type SearchHint = {
  Id?: string
  ItemId?: string
  Name: string
  Type: string
  AlbumArtist?: string
  Artists?: string[]
  Album?: string
  AlbumId?: string
  PrimaryImageTag?: string
  PrimaryImageItemId?: string
  ProductionYear?: number
  IndexNumber?: number
  RunTimeTicks?: number
}

export type SearchResults = { artists: Artist[]; albums: Album[]; songs: Song[] }

/**
 * Artists, albums, and songs matching `term` (the Swift app's `search`, Jellyfin's search hints) — in
 * one library when `libraryID` is set.
 */
export async function search(
  session: Session,
  term: string,
  libraryID?: string,
  signal?: AbortSignal,
): Promise<SearchResults> {
  const result = await get<{ SearchHints?: SearchHint[] }>(
    session,
    "/Search/Hints",
    {
      searchTerm: term,
      userId: session.userID,
      IncludeItemTypes: "MusicArtist,MusicAlbum,Audio",
      ...(libraryID ? { ParentId: libraryID } : {}),
    },
    signal,
  )
  const hints = result.SearchHints ?? []
  const ofType = (type: string) => {
    // A hint can repeat; keep the first of each item.
    const seen = new Set<string>()
    return hints.filter((hint) => {
      const id = hint.Id ?? hint.ItemId
      if (hint.Type !== type || !id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }
  const id = (hint: SearchHint) => (hint.Id ?? hint.ItemId)!
  return {
    artists: ofType("MusicArtist").map((hint) => ({
      id: id(hint),
      name: hint.Name,
      primaryImageTag: hint.PrimaryImageTag,
      genres: [],
      isFavorite: false,
    })),
    albums: ofType("MusicAlbum").map((hint) => ({
      id: id(hint),
      name: hint.Name,
      albumArtist: hint.AlbumArtist || hint.Artists?.[0] || undefined,
      primaryImageTag: hint.PrimaryImageTag,
      productionYear: hint.ProductionYear,
      genres: [],
      isFavorite: false,
    })),
    songs: ofType("Audio").map((hint) => {
      // A song's hint image is usually its album's; `PrimaryImageItemId` says whose it is.
      const imageItem = hint.PrimaryImageItemId ?? id(hint)
      const ownImage = imageItem === id(hint)
      return {
        id: id(hint),
        name: hint.Name,
        indexNumber: hint.IndexNumber,
        duration: hint.RunTimeTicks ? hint.RunTimeTicks / 10_000_000 : undefined,
        isFavorite: false,
        album: hint.Album || undefined,
        albumID: ownImage ? hint.AlbumId : imageItem,
        albumArtist: hint.AlbumArtist || hint.Artists?.[0] || undefined,
        productionYear: hint.ProductionYear,
        primaryImageTag: ownImage ? hint.PrimaryImageTag : undefined,
        albumPrimaryImageTag: ownImage ? undefined : hint.PrimaryImageTag,
      }
    }),
  }
}

/** An album's songs in disc-then-track order (the Swift app's `fetchAllSongsInAlbum`). */
export async function fetchSongs(session: Session, albumID: string, signal?: AbortSignal): Promise<Song[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    "/Items",
    {
      userId: session.userID,
      ParentId: albumID,
      IncludeItemTypes: "Audio",
      SortBy: "ParentIndexNumber,IndexNumber,SortName",
      EnableUserData: "true",
    },
    signal,
  )
  return result.Items.map(toSong)
}

/**
 * Every song in a library (all of them when `libraryID` isn't set), grouped by artist then album in
 * track order — the Swift app's `fetchAllSongsInLibrary`.
 */
export async function fetchLibrarySongs(session: Session, libraryID?: string, signal?: AbortSignal): Promise<Song[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    "/Items",
    {
      userId: session.userID,
      IncludeItemTypes: "Audio",
      // Recurse so a library returns every song beneath its artists and albums, not just direct children.
      Recursive: "true",
      SortBy: "AlbumArtist,Album,ParentIndexNumber,IndexNumber,SortName",
      Fields: "Genres",
      EnableUserData: "true",
      ...(libraryID ? { ParentId: libraryID } : {}),
    },
    signal,
  )
  return result.Items.map(toSong)
}

function toSong(item: RawItem): Song {
  return {
    id: item.Id,
    name: item.Name,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    duration: item.RunTimeTicks ? item.RunTimeTicks / 10_000_000 : undefined,
    isFavorite: item.UserData?.IsFavorite ?? false,
    album: item.Album || undefined,
    albumID: item.AlbumId,
    albumArtist: item.AlbumArtist || item.Artists?.[0] || undefined,
    productionYear: item.ProductionYear,
    primaryImageTag: item.ImageTags?.Primary,
    albumPrimaryImageTag: item.AlbumPrimaryImageTag,
  }
}

/** Marks or unmarks an album or song as a favorite. */
export async function setFavorite(session: Session, itemID: string, isFavorite: boolean) {
  const params = new URLSearchParams({ userId: session.userID })
  const response = await fetch(`${session.serverURL}/UserFavoriteItems/${itemID}?${params}`, {
    method: isFavorite ? "POST" : "DELETE",
    headers: { Authorization: authorization(session.accessToken) },
  })
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new Error(`The server responded with an error (${response.status}).`)
}

/** The user's music libraries (Jellyfin "views" whose collection type is music). */
export async function fetchLibraries(session: Session, signal?: AbortSignal): Promise<Item[]> {
  const result = await get<{ Items: RawItem[] }>(session, "/UserViews", { userId: session.userID }, signal)
  return result.Items.filter((item) => item.CollectionType === "music").map((item) => ({ id: item.Id, name: item.Name }))
}

/** The user's playlists, alphabetical. */
export type Playlist = Item & {
  primaryImageTag?: string
  /** How many songs it holds. */
  childCount?: number
  /** Total length in seconds. */
  duration?: number
  isFavorite: boolean
}

/**
 * The user's playlists, alphabetical (the Swift app's `fetchAllPlaylists`). Playlists live in their own
 * top-level view, not under a music library, so this searches the whole server.
 */
export async function fetchPlaylists(session: Session, signal?: AbortSignal): Promise<Playlist[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    "/Items",
    {
      userId: session.userID,
      IncludeItemTypes: "Playlist",
      Recursive: "true",
      SortBy: "SortName",
      SortOrder: "Ascending",
      Fields: "ChildCount",
      EnableUserData: "true",
    },
    signal,
  )
  return result.Items.map((item) => ({
    id: item.Id,
    name: item.Name,
    primaryImageTag: item.ImageTags?.Primary,
    childCount: item.ChildCount,
    duration: item.RunTimeTicks ? item.RunTimeTicks / 10_000_000 : undefined,
    isFavorite: item.UserData?.IsFavorite ?? false,
  }))
}

/** A playlist's songs, in playlist order (the Swift app's `fetchAllSongsInPlaylist`). */
export async function fetchPlaylistSongs(session: Session, playlistID: string, signal?: AbortSignal): Promise<Song[]> {
  const result = await get<{ Items: RawItem[] }>(
    session,
    `/Playlists/${playlistID}/Items`,
    { userId: session.userID, Fields: "Genres", EnableUserData: "true" },
    signal,
  )
  return result.Items.map(toSong)
}

/** The signed-in user's avatar, or `undefined` when they haven't set one. */
export async function fetchAvatarURL(session: Session, size: number, signal?: AbortSignal) {
  const user = await get<{ PrimaryImageTag?: string }>(session, `/Users/${session.userID}`, {}, signal)
  if (!user.PrimaryImageTag) return undefined
  const params = new URLSearchParams({ tag: user.PrimaryImageTag, maxWidth: String(size), maxHeight: String(size) })
  return `${session.serverURL}/Users/${session.userID}/Images/Primary?${params}`
}

/**
 * An item's primary image, scaled to fit `size` px while keeping its aspect ratio. `tag` ties the URL
 * to the current image so caches invalidate when the art changes. `undefined` when there's no art.
 */
export function artworkURL(session: Session, item: { id: string; primaryImageTag?: string }, size: number) {
  if (!item.primaryImageTag) return undefined
  const params = new URLSearchParams({
    maxWidth: String(size),
    maxHeight: String(size),
    tag: item.primaryImageTag,
  })
  return `${session.serverURL}/Items/${item.id}/Images/Primary?${params}`
}

/** A song's art: its own if it has any, otherwise its album's (the Swift app's `artworkURL(for:)`). */
export function songArtworkURL(session: Session, song: Song, size: number) {
  if (song.primaryImageTag) return artworkURL(session, song, size)
  if (song.albumID && song.albumPrimaryImageTag) {
    return artworkURL(session, { id: song.albumID, primaryImageTag: song.albumPrimaryImageTag }, size)
  }
  return undefined
}

// ---- Selected library ----------------------------------------------------------

const LIBRARY_KEY = "redfin:jellyfin-library"

/** The library the app browses (the Swift app's `@Shared(.jellyfinLibrary)`); `null` means all of them. */
export function useSelectedLibrary() {
  return useStored<Item>(LIBRARY_KEY)
}

export function selectLibrary(library: Item | null) {
  writeStored(LIBRARY_KEY, library)
}

// ---- Previewed item ------------------------------------------------------------

/** What a details page can preview: Artist Details Live opens an artist, Album Details Live an album, … */
export type PreviewKind = "artist" | "album" | "genre" | "playlist"

/**
 * The item a details page opens on, picked in the workbench toolbar and kept across reloads; `null`
 * means none picked (the page falls back to the first).
 */
export function usePreview(kind: PreviewKind) {
  return useStored<Item>(`redfin:preview:${kind}`)
}

export function setPreview(kind: PreviewKind, item: Item | null) {
  writeStored(`redfin:preview:${kind}`, item && { id: item.id, name: item.name })
}
