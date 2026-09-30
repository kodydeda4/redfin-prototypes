"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// Songs inside the app's sidebar, like the macOS app (see `SongsScreen` for the list itself).
export default function LiveSongs() {
  return <SidebarShell scope="songs" initialTag="songs" />
}
