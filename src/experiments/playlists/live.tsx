"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// All Playlists inside the app's sidebar, like the macOS app (see `PlaylistsScreen` for the list).
export default function LivePlaylists() {
  return <SidebarShell scope="playlists" initialTag="all-playlists" />
}
