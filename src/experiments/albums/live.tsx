"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// Albums inside the app's sidebar, like the macOS app (see `AlbumsScreen` for the grid itself).
export default function LiveAlbums() {
  return <SidebarShell scope="albums" initialTag="albums" />
}
