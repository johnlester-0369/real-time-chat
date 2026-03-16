import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

// ─── Validation ──────────────────────────────────────────────────────────────

const NAME_MIN = 2
const NAME_MAX = 32

// Centralised so the same rules apply on change, blur, and submit
function validateName(raw: string): string {
  const v = raw.trim()
  if (!v) return 'Display name is required.'
  if (v.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters.`
  if (v.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or less.`
  return ''
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NameEntryScreenProps {
  onNameSubmit: (name: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NameEntryScreen({ onNameSubmit }: NameEntryScreenProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  // Only show errors after the user has interacted to avoid nagging on first render
  const [touched, setTouched] = useState(false)

  function handleSubmit() {
    const err = validateName(value)
    if (err) {
      setError(err)
      setTouched(true)
      return
    }
    // Trim here — trimmed name stored in App, not the raw input value
    onNameSubmit(value.trim())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface px-4">
      <div className="w-full max-w-sm">

        {/* ── Brand mark ─────────────────────────────────────────────────── */}
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

        {/* ── Entry card ─────────────────────────────────────────────────── */}
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
                // Progressive validation: only re-validate after first blur/submit attempt
                if (touched) setError(validateName(e.target.value))
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              onBlur={() => {
                setTouched(true)
                setError(validateName(value))
              }}
              placeholder="e.g. Alex Chen"
              maxLength={NAME_MAX}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              autoComplete="off"
              aria-describedby={error ? 'name-error' : undefined}
              aria-invalid={error ? true : undefined}
              className={[
                'bg-surface-container rounded-xl px-4 py-3 text-body-md text-on-surface w-full',
                'placeholder:text-on-surface-variant border transition-all duration-fast',
                'focus:outline-none focus:ring-1',
                error
                  ? 'border-error focus:border-error focus:ring-error'
                  : 'border-outline-variant focus:border-primary focus:ring-primary',
              ].join(' ')}
            />

            {/* Error + char counter row — fixed height prevents layout shift */}
            <div className="flex items-start justify-between gap-2 min-h-[1.125rem]">
              {error
                ? (
                    <span
                      id="name-error"
                      role="alert"
                      className="text-label-sm text-error"
                    >
                      {error}
                    </span>
                  )
                : <span aria-hidden="true" />}
              <span className="text-label-sm text-on-surface-variant shrink-0 tabular-nums">
                {value.length}/{NAME_MAX}
              </span>
            </div>
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