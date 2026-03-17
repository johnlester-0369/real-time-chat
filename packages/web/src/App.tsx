import { useState, useRef, useEffect } from 'react'
import Avatar from '@/components/ui/data-display/Avatar'
import IconButton from '@/components/ui/buttons/IconButton'
import { useTheme } from '@/contexts/ThemeContext'
import { Hash, Moon, Send, Sun, Wifi, WifiOff } from 'lucide-react'
import Status from '@/components/ui/data-display/Status'
import NameEntryScreen from '@/components/chat/NameEntryScreen'
import { useSocket } from '@/chat'
import type { Message, UserColor } from '@/chat'

// Read identity from URL query params — set by handleNameSubmit on first join.
// URL params survive page refresh without touching localStorage, and the UUID is
// visible/shareable in the address bar for debugging reconnect issues.
function getUrlIdentity(): { userId: string; name: string } | null {
  const params = new URLSearchParams(window.location.search)
  const userId = params.get('userId')
  const name = params.get('name')
  // Guard against malformed URLs that have keys but empty values
  if (userId && name?.trim()) return { userId, name: name.trim() }
  return null
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isMessageFromMe(message: Message, currentUserId: string): boolean {
  // UUID comparison is authoritative — eliminates the name-matching fallback that
  // produced false positives when two users shared a display name
  return message.userId === currentUserId
}

export default function App() {
  const { theme, setTheme } = useTheme()
  const [draft, setDraft] = useState('')
  // Lazy initializer reads URL params synchronously before first render —
  // mirrors the original localStorage.getItem() pattern with no flash of NameEntryScreen
  const [userIdentity, setUserIdentity] = useState<{ userId: string; name: string } | null>(
    getUrlIdentity
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userColor: UserColor = 'info' // Could be derived from username hash for visual variety

  const { 
    isConnected, 
    messages, 
    users, 
    sendMessage,
    clearError,
    error 
  } = useSocket(
    userIdentity
      ? { userId: userIdentity.userId, name: userIdentity.name, color: userColor }
      : null
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleNameSubmit(name: string) {
    const userId = crypto.randomUUID()
    // Write identity to URL so page refresh restores the session automatically.
    // replaceState avoids polluting browser history with every name submission.
    const params = new URLSearchParams()
    params.set('userId', userId)
    params.set('name', name)
    history.replaceState(null, '', `?${params.toString()}`)
    setUserIdentity({ userId, name })
    // useSocket auto-joins when userIdentity transitions from null to a value
  }

  if (!userIdentity) {
    return (
      <NameEntryScreen
        onNameSubmit={handleNameSubmit}
        isConnected={isConnected}
        serverError={error}
        onClearServerError={clearError}
        onlineCount={users.length}
      />
    )
  }

  function handleSendMessage() {
    const text = draft.trim()
    if (!text) return
    sendMessage(text)
    setDraft('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      
      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="bg-warning text-on-warning flex items-center justify-center gap-2 text-label-sm py-2 px-4">
          <WifiOff className="w-4 h-4" />
          <span>Reconnecting...</span>
        </div>
      )}
      {error && (
        <div className="bg-error text-on-error flex items-center justify-center gap-2 text-label-sm py-2 px-4">
          <span>Error: {error}</span>
        </div>
      )}
      {isConnected && messages.length === 0 && !error && (
        <div className="bg-success text-on-success flex items-center justify-center gap-2 text-label-sm py-2 px-4">
          <Wifi className="w-4 h-4" />
          <span>Connected — waiting for messages...</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 shrink-0 bg-surface border-b border-outline-variant z-sticky">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden="true" />
          <span className="text-title-md text-on-surface font-medium">general</span>
          <span className="hidden sm:inline-block text-body-sm text-on-surface-variant ml-1 truncate">
            — public room · anyone can join
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-on-surface-variant">
            <Status.Indicator 
              colorPalette={isConnected ? 'success' : 'warning'} 
              size="sm" 
              pulse={isConnected}
            />
            <span className="text-label-md">{users.length} online</span>
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

      {/* Message list */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-3">

          {messages.map((msg, idx) => {
            const isMe = isMessageFromMe(msg, userIdentity.userId)
            const prevUser = idx > 0 ? messages[idx - 1]?.userId : null
            const isGrouped = prevUser === msg.userId

            // System events (join/leave) are infrastructure metadata, not conversation turns —
            // render as centered muted text matching the Facebook Messenger notification pattern
            // so they don't visually compete with user messages
            if (msg.userId === 'system') {
              return (
                <div key={msg.id} className="text-center text-label-sm text-on-surface-variant py-1 select-none">
                  {msg.text}
                </div>
              )
            }

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className="w-8 shrink-0 self-end">
                  {!isGrouped && (
                    <Avatar.Root
                      size="sm"
                      color={msg.userColor as UserColor}
                      variant="subtle"
                      name={msg.userName}
                    >
                      <Avatar.Fallback />
                    </Avatar.Root>
                  )}
              </div>

              <div className={`flex flex-col gap-0.5 max-w-[75%] sm:max-w-sm md:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                {/* min-w-0 prevents flex item from refusing to shrink below intrinsic content size */}
                {!isGrouped && (
                  <div className={`flex items-baseline gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-label-md font-medium text-on-surface">
                        {isMe ? userIdentity.name : msg.userName}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {formatTime(new Date(msg.timestamp))}
                      </span>
                  </div>
                )}

                {/* Responsive text wrapping: break-all for mobile (aggressive, prevents overflow), 
                    break-words for sm+ (preserves word boundaries when space allows).
                    whitespace-pre-wrap respects user-entered newlines while still wrapping. */}
                <div
                  className={[
                    'px-3.5 py-2 text-body-md break-all sm:break-words whitespace-pre-wrap leading-relaxed min-w-0',
                    isMe
                      ? 'bg-primary text-on-primary rounded-2xl rounded-br-sm'
                      : 'bg-surface-container-high text-on-surface rounded-2xl rounded-bl-sm',
                  ].join(' ')}
                >
                  {msg.text}
                </div>

                  {isGrouped && (
                    <span className="text-label-sm text-on-surface-variant px-1">
                      {formatTime(new Date(msg.timestamp))}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </main>

      {/* Input bar */}
      <footer className="shrink-0 border-t border-outline-variant bg-surface">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3">

          <div className={[
            "flex items-end gap-2 bg-surface-container rounded-2xl px-3 py-2 border transition-all duration-fast ease-standard",
            isConnected 
              ? "border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary" 
              : "border-warning/50 bg-warning/5"
          ].join(' ')}>
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent resize-none text-body-md text-on-surface placeholder:text-on-surface-variant outline-none min-h-[24px] max-h-32 py-0.5 leading-normal disabled:opacity-50"
              placeholder={isConnected ? "Message #general" : "Reconnecting..."}
              value={draft}
              rows={1}
              disabled={!isConnected}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message #general"
            />

            <IconButton
              icon={<Send className="w-4 h-4" />}
              aria-label="Send message"
              variant={draft.trim() && isConnected ? 'primary' : 'text'}
              size="sm"
              disabled={!isConnected || !draft.trim()}
              onClick={handleSendMessage}
            />
          </div>

          <p className="text-label-sm text-on-surface-variant text-center mt-2 select-none">
            Public room · Enter to send · Shift+Enter for new line
            {!isConnected && <span className="block text-warning">· Offline — messages will be sent when reconnected</span>}
          </p>
        </div>
      </footer>

    </div>
  )
}
