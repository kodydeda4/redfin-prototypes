"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// A playlist's details, reached the way the app does: All Playlists with a playlist opened (see
// `PlaylistDetails`) — the one picked in the workbench's Preview State, else the first. "‹ Playlists"
// goes back to the list.
export default function LivePlaylistDetails() {
  return <SidebarShell scope="playlist-details" initialTag="all-playlists" openPreview />
}
