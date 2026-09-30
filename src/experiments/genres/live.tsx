"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// Genres inside the app's sidebar, like the macOS app (see `GenresScreen` for the list itself).
export default function LiveGenres() {
  return <SidebarShell scope="genres" initialTag="genres" />
}
