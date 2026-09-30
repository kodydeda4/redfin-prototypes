"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import { EyeIcon, EyeOffIcon, LogOutIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"

// Mirrors `AuthenticationFeature` in redfin-swift: server URL + username + password, "Connect",
// and a "Couldn't Sign In" alert on failure.

const SESSION_KEY = "redfin:jellyfin-session"
const DEVICE_ID_KEY = "redfin:device-id"

type Session = {
  serverURL: string
  serverName?: string
  userID: string
  username: string
  accessToken: string
}

// ---- Jellyfin --------------------------------------------------------------

function deviceID() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/** Jellyfin identifies every client through this header, signed in or not. */
function authorization(token?: string) {
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

async function authenticate(serverURL: string, username: string, password: string): Promise<Session> {
  let base: URL
  try {
    base = normalizeServerURL(serverURL)
  } catch {
    throw new Error("The server URL isn't valid.")
  }
  const root = base.href.replace(/\/$/, "")

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
  }
}

async function signOut(session: Session) {
  await fetch(`${session.serverURL}/Sessions/Logout`, {
    method: "POST",
    headers: { Authorization: authorization(session.accessToken) },
  }).catch(() => {})
}

// The saved session lives in localStorage, so every device frame (and tab) shares one sign-in.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => e.key === SESSION_KEY && listener()
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function saveSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  listeners.forEach((l) => l())
}

function parseSession(raw: string | null): Session | null {
  try {
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

/** `undefined` until hydrated, so the server render doesn't flash the form for a signed-in user. */
function useSession() {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SESSION_KEY),
    () => undefined,
  )
  return useMemo(() => (raw === undefined ? undefined : parseSession(raw)), [raw])
}

// ---- Views -----------------------------------------------------------------

export default function LiveAuthentication() {
  const session = useSession()

  const leave = () => {
    if (session) void signOut(session)
    saveSession(null)
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-background pt-(--safe-top) pb-(--safe-bottom)">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-8 p-6">
        <Header />
        {session === undefined ? null : session ? (
          <SignedIn session={session} onSignOut={leave} />
        ) : (
          <SignInForm onSignIn={saveSession} />
        )}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex flex-col items-center gap-2 pt-10 text-center">
      <Image src="/redfin-logo.png" alt="" width={80} height={80} priority className="mb-1 size-20" />
      <h1 className="text-3xl font-bold tracking-tight">Redfin Music Player</h1>
      <p className="text-muted-foreground">Connect to your Jellyfin server to get started.</p>
    </div>
  )
}

function SignInForm({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [serverURL, setServerURL] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isRevealed, setIsRevealed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const canConnect = serverURL.trim() !== "" && username.trim() !== "" && !isLoading

  const connect = async () => {
    if (!canConnect) return
    setIsLoading(true)
    try {
      onSignIn(await authenticate(serverURL, username.trim(), password))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setIsLoading(false)
    }
  }

  /** Return moves to the next field, like the iOS `.next` submit label. */
  const advance = (e: React.KeyboardEvent, next: React.RefObject<HTMLInputElement | null>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    next.current?.focus()
  }

  const fieldClass = "h-11 rounded-xl px-3 text-base md:text-sm"

  return (
    <>
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault()
          void connect()
        }}
      >
        <FieldGroup className="gap-3.5">
          <Field>
            <FieldLabel htmlFor="server-url">Server URL</FieldLabel>
            <Input
              id="server-url"
              // Not type="url": native validation would reject a bare host like `jellyfin.local:8096`.
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://jellyfin.example.com"
              value={serverURL}
              onChange={(e) => setServerURL(e.target.value)}
              onKeyDown={(e) => advance(e, usernameRef)}
              disabled={isLoading}
              className={fieldClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              ref={usernameRef}
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => advance(e, passwordRef)}
              disabled={isLoading}
              className={fieldClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <InputGroup className="h-11 rounded-xl">
              <InputGroupInput
                ref={passwordRef}
                id="password"
                type={isRevealed ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="px-3 text-base md:text-sm"
              />
              {password ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={isRevealed ? "Hide password" : "Show password"}
                    onClick={() => setIsRevealed((v) => !v)}
                  >
                    {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" disabled={!canConnect} className="h-11 w-full rounded-full text-base font-semibold">
          {isLoading ? <Spinner /> : "Connect"}
        </Button>
      </form>

      <AlertDialog open={error !== null} onOpenChange={(open) => !open && setError(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Couldn&apos;t Sign In</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="col-span-2">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SignedIn({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1 rounded-xl border p-4 text-sm">
        <span className="text-muted-foreground">Signed in as</span>
        <span className="text-base font-semibold">{session.username}</span>
        <span className="truncate text-muted-foreground">{session.serverName ?? session.serverURL}</span>
      </div>
      <Button variant="outline" size="lg" onClick={onSignOut} className="h-11 w-full rounded-full text-base font-semibold">
        <LogOutIcon />
        Sign Out
      </Button>
    </div>
  )
}
