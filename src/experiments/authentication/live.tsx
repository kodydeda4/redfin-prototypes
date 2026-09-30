"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { EyeIcon, EyeOffIcon } from "lucide-react"

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
import { authenticate, saveSession, type Session } from "@/lib/jellyfin"

// Mirrors `AuthenticationFeature` in redfin-swift: server URL + username + password, "Connect",
// and a "Couldn't Sign In" alert on failure.

// ---- Views -----------------------------------------------------------------

// Always the sign-in screen, even when signed in, so it can be looked at any time. The current account
// (and Sign Out) lives in the workbench's Preview State panel.
export default function LiveAuthentication() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-background pt-(--safe-top) pb-(--safe-bottom)">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-8 p-6">
        <SignInForm onSignIn={saveSession} />
      </div>
    </div>
  )
}

/**
 * The developer sign-in, from `.env.local` (like the Swift app's `developerValue`). `undefined` unless
 * all three are set, which leaves the logo inert everywhere else.
 */
const developer =
  process.env.NEXT_PUBLIC_DEV_JELLYFIN_SERVER_URL && process.env.NEXT_PUBLIC_DEV_JELLYFIN_USERNAME
    ? {
        serverURL: process.env.NEXT_PUBLIC_DEV_JELLYFIN_SERVER_URL,
        username: process.env.NEXT_PUBLIC_DEV_JELLYFIN_USERNAME,
        password: process.env.NEXT_PUBLIC_DEV_JELLYFIN_PASSWORD ?? "",
      }
    : undefined

function Header({ onLogoClick }: { onLogoClick?: () => void }) {
  const logo = <Image src="/redfin-logo.png" alt="" width={80} height={80} priority className="size-20" />
  return (
    <div className="flex flex-col items-center gap-2 pt-10 text-center">
      {onLogoClick ? (
        <button type="button" onClick={onLogoClick} aria-label="Fill developer sign-in" className="mb-1 rounded-[22%]">
          {logo}
        </button>
      ) : (
        <div className="mb-1">{logo}</div>
      )}
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
    } finally {
      // The form stays up after signing in (it's the page's whole point), so stop the spinner either way.
      setIsLoading(false)
    }
  }

  /** Return moves to the next field, like the iOS `.next` submit label. */
  const advance = (e: React.KeyboardEvent, next: React.RefObject<HTMLInputElement | null>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    next.current?.focus()
  }

  /** Fills the developer sign-in, or clears the fields if they're already filled (the Swift toggle). */
  const toggleDeveloper = () => {
    if (!developer || isLoading) return
    const fill = serverURL === ""
    setServerURL(fill ? developer.serverURL : "")
    setUsername(fill ? developer.username : "")
    setPassword(fill ? developer.password : "")
    setIsRevealed(false)
  }

  const fieldClass = "h-11 rounded-xl px-3 text-base md:text-sm"

  return (
    <>
      <Header onLogoClick={developer ? toggleDeveloper : undefined} />
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
