"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// The settings sheet over the app, opened the way the app does it: from the account at the bottom of
// the sidebar (see `SettingsSheet`). Close it and tap the account to bring it back.
export default function LiveSettings() {
  return <SidebarShell scope="settings" initialTag="albums" openSettings />
}
