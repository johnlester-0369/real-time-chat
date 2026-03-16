import { useState, useRef, useEffect } from 'react'
import Avatar from '@/components/ui/data-display/Avatar'
import IconButton from '@/components/ui/buttons/IconButton'
import { useTheme } from '@/contexts/ThemeContext'
import { Hash, Moon, Send, Sun } from 'lucide-react'
import Status from '@/components/ui/data-display/Status'
import NameEntryScreen from '@/components/chat/NameEntryScreen'

// ─── Domain Types ────────────────────────────────────────────────────────────

// Subset of AvatarColor — excludes 'neutral' and 'error' to keep chat colors friendly
type UserColor = 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'info'

interface ChatUser {
  id: string
  name: string
  color: UserColor
}

interface Message {
  id: string
  user: ChatUser
  text: string
  timestamp: Date
}

// ─── Static Seed Data ────────────────────────────────────────────────────────

// Current user — messages from this user render as right-aligned primary bubbles
const ME: ChatUser = { id: 'me', name: 'You', color: 'info' }

// Mirrors the THEME_STORAGE_KEY pattern from theme.util — one key per concern
const CHAT_NAME_KEY = 'chat-display-name'

const ALEX: ChatUser = { id: 'alex', name: 'Alex Chen', color: 'primary' }
const MAYA: ChatUser = { id: 'maya', name: 'Maya Rodriguez', color: 'secondary' }
const JAMES: ChatUser = { id: 'james', name: 'James Kim', color: 'tertiary' }
const SARAH: ChatUser = { id: 'sarah', name: 'Sarah Wilson', color: 'success' }

const ROOM_USERS: ChatUser[] = [ALEX, MAYA, JAMES, SARAH, ME]

// Build a seed message with a relative timestamp offset so the conversation
// looks realistic on first load regardless of when the page is opened
function makeMsg(user: ChatUser, text: string, minutesAgo: number): Message {
  const ts = new Date()
  ts.setMinutes(ts.getMinutes() - minutesAgo)
  return { id: crypto.randomUUID(), user, text, timestamp: ts }
}

const INITIAL_MESSAGES: Message[] = [
  makeMsg(ALEX, 'Hey everyone! 👋 Welcome to the general room.', 18),
  makeMsg(MAYA, 'Hi Alex! Great to see everyone here.', 16),
  makeMsg(JAMES, 'This chat is looking really clean. Love the design!', 14),
  makeMsg(SARAH, 'Agreed. The dark mode is especially nice 🌙', 12),
  makeMsg(ALEX, 'Anyone working on something interesting this week?', 10),
  makeMsg(MAYA, "Yeah, I'm building a real-time analytics dashboard for the team.", 9),
  makeMsg(JAMES, 'Just shipped optimistic UI updates on our app. Absolute game changer!', 7),
  makeMsg(SARAH, 'That sounds awesome. How do you handle rollback on error?', 5),
  makeMsg(JAMES, 'We snapshot state before the mutation and restore on failure. Works great so far!', 4),
  makeMsg(MAYA, 'Smart approach 💡', 2),
]

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const { theme, setTheme } = useTheme()
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [draft, setDraft] = useState('')

  // Lazy initializer reads localStorage once at mount — avoids per-render storage access
  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem(CHAT_NAME_KEY) ?? ''
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to latest message whenever the list grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // App owns all localStorage interaction; NameEntryScreen is pure UI via this callback
  function handleNameSubmit(name: string) {
    localStorage.setItem(CHAT_NAME_KEY, name)
    setUserName(name)
  }

  // All hooks are above this line — early return is Rules-of-Hooks compliant
  if (!userName) return <NameEntryScreen onNameSubmit={handleNameSubmit} />

  function sendMessage() {
    const text = draft.trim()
    if (!text) return

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), user: { ...ME, name: userName }, text, timestamp: new Date() },
    ])
    setDraft('')

    // Restore focus after React processes the state flush
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <div className="flex flex-col h-screen bg-surface">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-14 shrink-0 bg-surface-container-low border-b border-outline-variant shadow-elevation-1 z-sticky">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden="true" />
          <span className="text-title-md text-on-surface font-medium">general</span>
          <span className="hidden sm:inline-block text-body-sm text-on-surface-variant ml-1 truncate">
            — public room · anyone can join
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Online count — hidden on very small screens where space is tight */}
          <div className="hidden sm:flex items-center gap-1.5 text-on-surface-variant">
            <Status.Indicator colorPalette="success" size="sm" pulse />
            <span className="text-label-md">{ROOM_USERS.length} online</span>
          </div>

          <IconButton
            icon={
              theme === 'dark'
                ? <Sun className="w-5 h-5" />
                : <Moon className="w-5 h-5" />
            }
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            variant="text"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        </div>
      </header>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-3">

          {messages.map((msg, idx) => {
            const isMe = msg.user.id === ME.id

            // Collapse avatar + name header for back-to-back messages from same user —
            // creates a threaded feel without adding visual noise
            const isGrouped = idx > 0 && messages[idx - 1]!.user.id === msg.user.id

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar slot — empty placeholder when grouped so bubbles stay aligned */}
                <div className="w-8 shrink-0 self-end">
                  {!isGrouped && (
                    <Avatar.Root
                      size="sm"
                      color={msg.user.color}
                      variant="subtle"
                      name={msg.user.name}
                    >
                      <Avatar.Fallback />
                    </Avatar.Root>
                  )}
                </div>

                {/* Bubble column */}
                <div className={`flex flex-col gap-0.5 max-w-[75%] sm:max-w-sm md:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>

                  {/* Name + timestamp header — only shown on first bubble in a group */}
                  {!isGrouped && (
                    <div className={`flex items-baseline gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-label-md font-medium text-on-surface">
                        {isMe ? userName : msg.user.name}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={[
                      'px-3.5 py-2 text-body-md break-words leading-relaxed',
                      isMe
                        ? 'bg-primary text-on-primary rounded-2xl rounded-br-sm'
                        : 'bg-surface-container-high text-on-surface rounded-2xl rounded-bl-sm',
                    ].join(' ')}
                  >
                    {msg.text}
                  </div>

                  {/* Inline timestamp beneath grouped bubbles so context is still scannable */}
                  {isGrouped && (
                    <span className="text-label-sm text-on-surface-variant px-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Invisible anchor — scrollIntoView target so new messages stay in view */}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </main>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-outline-variant bg-surface-container-low">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3">

          {/* Composite input — focus-within ring mimics a focused field without a real border on textarea */}
          <div className="flex items-end gap-2 bg-surface-container rounded-2xl px-3 py-2 border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all duration-fast ease-standard">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent resize-none text-body-md text-on-surface placeholder:text-on-surface-variant outline-none min-h-[24px] max-h-32 py-0.5 leading-normal"
              placeholder="Message #general"
              value={draft}
              rows={1}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                // Enter sends; Shift+Enter inserts a newline for multi-line messages
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              aria-label="Message #general"
            />

            <IconButton
              icon={<Send className="w-4 h-4" />}
              aria-label="Send message"
              // Visually indicate send readiness — primary when there's text, text variant otherwise
              variant={draft.trim() ? 'primary' : 'text'}
              size="sm"
              onClick={sendMessage}
            />
          </div>

          <p className="text-label-sm text-on-surface-variant text-center mt-2 select-none">
            Public room · Enter to send · Shift+Enter for new line
          </p>
        </div>
      </footer>

    </div>
  )
}
