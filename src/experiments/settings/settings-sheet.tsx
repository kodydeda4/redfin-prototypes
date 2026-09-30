"use client"

import { useEffect, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { useTheme } from "next-themes"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleUserRoundIcon,
  ExternalLinkIcon,
  LogOutIcon,
  PaletteIcon,
  ServerIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FadeImage } from "@/experiments/shared/details-page"
import { fetchAvatarURL, saveSession, signOut, type Session } from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"
import { cn } from "@/lib/utils"
import { version } from "../../../package.json"

// Mirrors `SettingsFeature` in redfin-swift: a sheet with the account's avatar and name, rows for
// Server and Appearance (each pushes a page inside the sheet), Sign Out (after a "Sign out?"
// confirmation), and the app name and version at the bottom. A bottom sheet on iPhone, a centered
// card on iPad. Open state and page are synced across the workbench's device frames.

type Page = "root" | "server" | "appearance"

/** Whether the settings sheet is open (shared by the sidebar's account button and the sheet). */
export function useSettingsOpen(initial = false) {
  return useSynced("settings-open", initial)
}

export function SettingsSheet({ session, initialOpen = false }: { session: Session; initialOpen?: boolean }) {
  const [isOpen, setOpen] = useSettingsOpen(initialOpen)
  const [page, setPage] = useSynced<Page>("settings-page", "root")

  const close = () => {
    setOpen(false)
    setPage("root")
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => (open ? setOpen(true) : close())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-background text-foreground shadow-2xl outline-none ring-1 ring-foreground/10 transition-[translate,opacity,scale] duration-200",
            // iPhone: a sheet rising from the bottom, clear of the status bar.
            "inset-x-0 bottom-0 top-[calc(var(--safe-top)+0.75rem)] rounded-t-3xl data-ending-style:translate-y-full data-starting-style:translate-y-full",
            // iPad: a centered card.
            "md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(40rem,calc(100%-4rem))] md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:data-ending-style:translate-y-[-50%] md:data-ending-style:scale-95 md:data-ending-style:opacity-0 md:data-starting-style:translate-y-[-50%] md:data-starting-style:scale-95 md:data-starting-style:opacity-0",
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            {page === "root" ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => setPage("root")}
                className="-ml-2 flex h-11 items-center gap-0.5 pr-2 text-[17px] text-red-500"
              >
                <ChevronLeftIcon className="size-6" />
                Settings
              </button>
            )}
            <Dialog.Close
              aria-label="Close"
              className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70"
            >
              <XIcon className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(var(--safe-bottom)+1.5rem)]">
            {page === "server" ? (
              <ServerPage session={session} />
            ) : page === "appearance" ? (
              <AppearancePage />
            ) : (
              <RootPage session={session} onOpen={setPage} onSignOut={close} />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function RootPage({
  session,
  onOpen,
  onSignOut,
}: {
  session: Session
  onOpen: (page: Page) => void
  onSignOut: () => void
}) {
  const [avatar, setAvatar] = useState<{ token: string; url?: string }>()
  const [isConfirming, setConfirming] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchAvatarURL(session, 180, controller.signal).then(
      (url) => setAvatar({ token: session.accessToken, url }),
      () => {},
    )
    return () => controller.abort()
  }, [session])
  const avatarURL = avatar?.token === session.accessToken ? avatar.url : undefined

  const signOutNow = () => {
    void signOut(session)
    saveSession(null)
    onSignOut()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="size-22 overflow-hidden rounded-full bg-muted">
          {avatarURL ? (
            <FadeImage src={avatarURL} className="size-full object-cover" />
          ) : (
            <CircleUserRoundIcon className="size-full text-muted-foreground" strokeWidth={1} />
          )}
        </div>
        <Dialog.Title className="text-3xl font-bold tracking-tight">{session.username}</Dialog.Title>
      </div>

      <Group>
        <Row icon={ServerIcon} tile="bg-neutral-900 dark:bg-neutral-800" title="Server" onClick={() => onOpen("server")} />
        <Row icon={PaletteIcon} tile="bg-pink-500" title="Appearance" onClick={() => onOpen("appearance")} />
      </Group>

      <Group>
        <Row icon={LogOutIcon} tile="bg-red-500" title="Sign Out" chevron={false} onClick={() => setConfirming(true)} />
      </Group>

      <div className="flex flex-col items-center gap-1 py-4 opacity-40">
        <p className="text-2xl font-bold tracking-tight">Redfin Music</p>
        <p className="text-sm">Version {version}</p>
      </div>

      <AlertDialog open={isConfirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={signOutNow}>
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** The server this account is on: name, Jellyfin version, and address, with a link to its web UI. */
function ServerPage({ session }: { session: Session }) {
  const [info, setInfo] = useState<{ ServerName?: string; Version?: string }>()

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${session.serverURL}/System/Info/Public`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : undefined))
      .then(setInfo, () => {})
    return () => controller.abort()
  }, [session.serverURL])

  const rows: [string, string | undefined][] = [
    ["Name", info?.ServerName ?? session.serverName],
    ["Version", info?.Version],
    ["URL", session.serverURL],
  ]

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-3xl font-bold tracking-tight">Server</h2>
      <Group>
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="flex min-h-12 items-center gap-4 px-4 py-2">
              <span className="shrink-0">{label}</span>
              <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">{value}</span>
            </div>
          ) : null,
        )}
        <a
          href={session.serverURL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center gap-2 px-4 py-2 text-red-500 transition-colors hover:bg-foreground/5"
        >
          Open
          <ExternalLinkIcon className="size-4" />
        </a>
      </Group>
    </div>
  )
}

/** The color scheme — shared with the workbench's own appearance toggle. */
function AppearancePage() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Appearance</h2>
        <p className="text-sm text-muted-foreground">Choose your preferred look.</p>
      </div>
      <Group>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className="flex min-h-12 w-full items-center px-4 py-2 text-left transition-colors hover:bg-foreground/5"
          >
            <span className="flex-1">{option.label}</span>
            {theme === option.value ? <CheckIcon className="size-5 text-red-500" /> : null}
          </button>
        ))}
      </Group>
    </div>
  )
}

/** A rounded group of rows with hairlines between them, like the Swift `ListSection`. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted/60">{children}</div>
  )
}

/** A settings row: a colored icon tile, the title, and a chevron when it opens a page. */
function Row({
  icon: Icon,
  tile,
  title,
  chevron = true,
  onClick,
}: {
  icon: LucideIcon
  tile: string
  title: string
  chevron?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-foreground/5"
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-white", tile)}>
        <Icon className="size-4.5" />
      </span>
      <span className="flex-1 text-[17px]">{title}</span>
      {chevron ? <ChevronRightIcon className="size-5 text-muted-foreground" /> : null}
    </button>
  )
}
