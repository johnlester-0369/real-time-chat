import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

const NAME_MIN = 2
const NAME_MAX = 32

function validateName(raw: string): string {
  const v = raw.trim()
  if (!v) return 'Display name is required.'
  if (v.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters.`
  if (v.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or less.`
  return ''
}

interface NameEntryScreenProps {
  onNameSubmit: (name: string) => void
  isConnected: boolean
  // Server-side join rejection error (e.g. name already taken) — surfaced via useSocket's error event
  serverError?: string | null
  onClearServerError?: () => void
  // Live count from room:history so the user can see activity before joining
  onlineCount?: number
}

export default function NameEntryScreen({
  onNameSubmit,
  isConnected,
  serverError,
  onClearServerError,
  onlineCount = 0,
}: NameEntryScreenProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  function handleSubmit() {
    const err = validateName(value)
    if (err) {
      setError(err)
      setTouched(true)
      return
    }
    onNameSubmit(value.trim())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface px-4">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center shadow-elevation-2">
            <MessageCircle className="w-8 h-8 text-on-primary-container" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-headline-md text-on-surface font-semibold">
              Welcome to Chat
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              Choose a display name to join the conversation
            </p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-3xl p-6 shadow-elevation-1 flex flex-col gap-5">

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="display-name"
              className="text-label-lg text-on-surface font-medium"
            >
              Display Name
            </label>

            <input
              id="display-name"
              type="text"
              value={value}
              onChange={e => {
                setValue(e.target.value)
                if (touched) setError(validateName(e.target.value))
                // Clear server-side name-taken error so the user can attempt a different name cleanly
                onClearServerError?.()
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              onBlur={() => {
                setTouched(true)
                setError(validateName(value))
              }}
              placeholder="e.g. Alex Chen"
              maxLength={NAME_MAX}
              autoFocus
              autoComplete="off"
              aria-describedby={(serverError ?? error) ? 'name-error' : undefined}
              aria-invalid={(serverError ?? error) ? true : undefined}
              className={[
                'bg-surface-container rounded-xl px-4 py-3 text-body-md text-on-surface w-full',
                'placeholder:text-on-surface-variant border transition-all duration-fast',
                'focus:outline-none focus:ring-1',
                (serverError ?? error)
                  ? 'border-error focus:border-error focus:ring-error'
                  : 'border-outline-variant focus:border-primary focus:ring-primary',
              ].join(' ')}
            />

            <div className="flex items-start justify-between gap-2 min-h-[1.125rem]">
              {(serverError ?? error)
                ? (
                    <span
                      id="name-error"
                      role="alert"
                      className="text-label-sm text-error"
                    >
                      {serverError ?? error}
                    </span>
                  )
                : <span aria-hidden="true" />}
              <span className="text-label-sm text-on-surface-variant shrink-0 tabular-nums">
                {value.length}/{NAME_MAX}
              </span>
            </div>
          </div>

          {/* Connection status indicator — decoupled from button so the user can
              still submit their name while offline; useSocket auto-joins on reconnect */}
          <div className="flex items-center justify-center gap-2 text-label-sm">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-warning animate-pulse'}`} />
              <span className={isConnected ? 'text-success' : 'text-on-surface-variant'}>
                {isConnected ? 'Server connected' : 'Connecting to server...'}
              </span>
            </div>
            {/* Show online presence before joining — room:history delivers current users on connect */}
            {isConnected && (
              <span className="text-on-surface-variant">
                · {onlineCount} online
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="w-full bg-primary text-on-primary rounded-xl py-3 text-label-lg font-medium transition-all duration-fast ease-standard hover:opacity-90 active:scale-[0.98] disabled:opacity-state-disabled disabled:pointer-events-none"
          >
            Join Chat
          </button>
        </div>

        <p className="text-label-sm text-on-surface-variant text-center mt-4 select-none">
          Your name is saved locally — no account required
        </p>

      </div>
    </div>
  )
}
