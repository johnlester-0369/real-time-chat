/**
 * Chat Screen — main route (/)
 *
 * Mobile equivalent of web's src/App.tsx. Same domain structure:
 *   - Identity from AsyncStorage (mobile) vs URL params (web)
 *   - useSocket hook for real-time state
 *   - NameEntryScreen gate before identity is set
 *   - Header with channel name, online count, theme toggle
 *   - Scrollable message list with grouped bubbles
 *   - TextInput + send button footer with KeyboardAvoidingView
 *
 * Stack.Screen options={{ headerShown: false }} suppresses expo-router's
 * default navigation header so the chat renders its own custom header —
 * mirroring the web's full-viewport layout control.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/chat';
import type { Message, UserColor } from '@/chat';
import NameEntryScreen from '@/components/chat/NameEntryScreen';
import Avatar from '@/components/ui/data-display/Avatar';
import Status from '@/components/ui/data-display/Status';
import IconButton from '@/components/ui/buttons/IconButton';

// ============================================================================
// CONSTANTS
// ============================================================================

const IDENTITY_KEY = 'chat_identity';
const USER_COLOR: UserColor = 'info';

// How close to the bottom (px) counts as "at bottom".
// Large enough to absorb sub-pixel rounding; small enough not to misfire mid-list.
const BOTTOM_THRESHOLD = 40;

// ============================================================================
// UUID
// ============================================================================

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Reads persisted identity from AsyncStorage.
 * Mobile equivalent of web's getUrlIdentity() — AsyncStorage replaces URL params
 * because deep-link URL params in Expo require expo-linking setup and don't
 * survive all navigation patterns the way a persistent key-value store does.
 */
async function getStoredIdentity(): Promise<{ userId: string; name: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; name?: string };
    if (parsed?.userId && parsed?.name) return { userId: parsed.userId, name: parsed.name };
    return null;
  } catch {
    return null;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isMessageFromMe(message: Message, currentUserId: string): boolean {
  // UUID comparison is authoritative — eliminates name-matching false positives when
  // two users share a display name
  return message.userId === currentUserId;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function Index() {
  const { colors, tokens, rgba, colorScheme, toggleColorScheme } = useTheme();
  const [draft, setDraft] = useState('');
  const [identity, setIdentity] = useState<{ userId: string; name: string } | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Scroll measurement refs ──────────────────────────────────────────────
  //
  // Three refs give us a complete, always-fresh picture of the ScrollView state:
  //
  //   scrollOffset  — updated by onScroll (user drags) AND manually after every
  //                   programmatic scrollTo. scrollTo(animated:false) does NOT
  //                   fire onScroll in RN, so we write to this ref ourselves
  //                   after every programmatic scroll to keep it honest.
  //
  //   contentHeight — updated by onContentSizeChange. Never goes stale because
  //                   RN fires this whenever content height changes.
  //
  //   layoutHeight  — updated by onLayout. Reflects the current visible viewport
  //                   height of the ScrollView, which changes whenever KAV
  //                   resizes it (keyboard open/close).
  //
  // computeIsAtBottom() derives the answer fresh from all three at call time —
  // no cached boolean ref that can go stale between events.
  //
  // WHY NOT JUST USE A BOOLEAN REF:
  //   The previous approach stored isAtBottom as a ref and read it in keyboard
  //   listeners. It went wrong because:
  //   1. Keyboard open  → scrollToEnd fires → onScroll overwrites scrollOffset
  //   2. Keyboard close → scrollTo(animated:false) restores position visually
  //                       BUT onScroll does NOT fire → scrollOffset stays at
  //                       the post-scrollToEnd value
  //   3. isAtBottom ref also stays wrong (true) because onScroll never corrected it
  //   4. Keyboard opens again → snapshots the wrong scrollOffset → wrong branch
  //
  // With three measured refs + a fresh compute function, none of that is possible.

  const scrollOffset = useRef(0);
  const contentHeight = useRef(0);
  const layoutHeight = useRef(0);

  // Snapshot taken at keyboard-open time, used to restore on dismiss.
  const preKeyboardOffset = useRef(0);
  // Whether the user was at the bottom when the keyboard opened.
  // Determines dismiss strategy: scrollToEnd vs restore-offset.
  const preKeyboardWasAtBottom = useRef(true);

  // 'height' while IME is open so KAV cooperates with Android's resize pass
  const [kavBehavior, setKavBehavior] = useState<'height' | undefined>(undefined);

  // Fresh bottom check — computed from live measurements, never stale
  function computeIsAtBottom(): boolean {
    return contentHeight.current - layoutHeight.current - scrollOffset.current < BOTTOM_THRESHOLD;
  }

  useEffect(() => {
    getStoredIdentity()
      .then(stored => setIdentity(stored))
      .finally(() => setIdentityLoaded(true));
  }, []);

  const { isConnected, messages, users, sendMessage, clearError, error } = useSocket(
    identity ? { userId: identity.userId, name: identity.name, color: USER_COLOR } : null,
  );

  // Scroll to bottom when new messages arrive — same behaviour as web's bottomRef.scrollIntoView
  useEffect(() => {
    if (messages.length > 0) {
      // requestAnimationFrame-equivalent delay lets RN finish the layout pass before scrolling
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // Scroll anchoring — compensate scroll position by the keyboard height on both
  // open and close so the user's reading position stays in view.
  //
  // On open:  scroll DOWN by keyboard height (viewport shrinks, content appears to shift up)
  // On close: scroll UP by the same stored height (viewport grows, content appears to shift down)
  //
  // lastKeyboardHeight stores the exact height used on open so the dismiss subtracts
  // the same value — prevents drift if the OS reports slightly different heights between events.
  //
  // Android: keyboardDidShow/Hide fires after softwareKeyboardLayoutMode resize pass,
  //          so KAV layout is settled before we scroll.
  // iOS:     keyboardWillShow/Hide fires before animation — animated:false keeps
  //          the scroll in sync with the keyboard animation visually.
  useEffect(() => {
    if (Platform.OS === 'android') {
      const show = Keyboard.addListener('keyboardDidShow', (e) => {
        const kbHeight = e.endCoordinates.height;
        lastKeyboardHeight.current = kbHeight;
        setKavBehavior('height');
        scrollRef.current?.scrollTo({
          y: scrollOffset.current + kbHeight,
          animated: false,
        });
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        setKavBehavior(undefined);
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffset.current - lastKeyboardHeight.current),
          animated: false,
        });
      });
      return () => { show.remove(); hide.remove(); };
    } else {
      const show = Keyboard.addListener('keyboardWillShow', (e) => {
        const kbHeight = e.endCoordinates.height;
        lastKeyboardHeight.current = kbHeight;
        scrollRef.current?.scrollTo({
          y: scrollOffset.current + kbHeight,
          animated: false,
        });
      });
      const hide = Keyboard.addListener('keyboardWillHide', () => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffset.current - lastKeyboardHeight.current),
          animated: false,
        });
      });
      return () => { show.remove(); hide.remove(); };
    }
  }, []);

  async function handleNameSubmit(name: string) {
    const userId = uuidv4();
    // Persist identity so screen restores session on next app launch —
    // replaces web's replaceState(null, '', `?${params}`) URL persistence
    await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify({ userId, name }));
    setIdentity({ userId, name });
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft('');
  }

  // Render nothing until AsyncStorage read resolves to prevent NameEntryScreen flash
  if (!identityLoaded) return null;

  if (!identity) {
    return (
      <>
        {/* Suppress the expo-router "index" header — NameEntryScreen is a full-screen
            entry gate with no navigation chrome; without this, the route filename
            "index" appears as the Stack title before identity is established */}
        <Stack.Screen options={{ headerShown: false }} />
        <NameEntryScreen
          onNameSubmit={handleNameSubmit}
          isConnected={isConnected}
          serverError={error}
          onClearServerError={clearError}
          onlineCount={users.length}
        />
      </>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: rgba(colors.surface) }]}>
      {/* Suppress expo-router's default header — chat renders its own */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* 'bottom' edge handles nav-bar clearance at the container level so nothing
          inside KAV needs inset math — prevents inset/KAV resize-pass conflicts */}
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>

        {/* ── Connection Status Banners ── */}
        {!isConnected && (
          <View style={[styles.banner, { backgroundColor: rgba(colors.warning) }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={rgba(colors.onWarning)} />
            <Text style={[styles.bannerText, { color: rgba(colors.onWarning), ...tokens.typography.labelSmall }]}>
              Reconnecting...
            </Text>
          </View>
        )}
        {error && (
          <View style={[styles.banner, { backgroundColor: rgba(colors.error) }]}>
            <Text style={[styles.bannerText, { color: rgba(colors.onError), ...tokens.typography.labelSmall }]}>
              Error: {error}
            </Text>
          </View>
        )}

        {/* ── Header ── */}
        <View style={[
          styles.header,
          {
            backgroundColor: rgba(colors.surface),
            borderBottomColor: rgba(colors.outlineVariant),
          },
        ]}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="tag" size={20} color={rgba(colors.onSurfaceVariant)} />
            <Text style={[styles.headerTitle, { color: rgba(colors.onSurface), ...tokens.typography.titleMedium }]}>
              general
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Status.Indicator
              colorPalette={isConnected ? 'success' : 'warning'}
              size="sm"
              pulse={isConnected}
            />
            <Text style={[styles.onlineCount, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelMedium }]}>
              {users.length} online
            </Text>
            <IconButton
              icon={(color) => (
                <Ionicons
                  name={colorScheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
                  size={20}
                  color={color}
                />
              )}
              variant="text"
              size="md"
              onPress={toggleColorScheme}
              aria-label={colorScheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            />
          </View>
        </View>

        {/* ── Messages + Input ── */}
        <KeyboardAvoidingView
          style={styles.flex}
          // iOS: 'padding' as before. Android: dynamic — 'height' while IME open, undefined after
          // dismiss so KAV's reset doesn't race the system softwareKeyboardLayoutMode resize pass
          behavior={Platform.OS === 'ios' ? 'padding' : kavBehavior}
          keyboardVerticalOffset={0}
        >
          {/* Message list */}
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Track scroll position so keyboard open/close can compensate with the
            // exact offset delta — preserves reading position in both directions
            onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            {messages.map((msg, idx) => {
              const isMe = isMessageFromMe(msg, identity.userId);
              const prevUserId = idx > 0 ? messages[idx - 1]?.userId : null;
              const isGrouped = prevUserId === msg.userId;

              // System events (join/leave) render as centered muted text —
              // same treatment as web to avoid visually competing with user messages
              if (msg.userId === 'system') {
                return (
                  <Text
                    key={msg.id}
                    style={[
                      styles.systemMsg,
                      { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelSmall },
                    ]}
                  >
                    {msg.text}
                  </Text>
                );
              }

              return (
                <View
                  key={msg.id}
                  style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
                >
                  {/* Avatar slot — 32px wide to match web's `w-8` */}
                  <View style={[styles.avatarSlot, isMe ? styles.avatarSlotMe : styles.avatarSlotOther]}>
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
                  </View>

                  {/* Bubble column */}
                  <View style={[styles.bubbleCol, isMe ? styles.bubbleColMe : styles.bubbleColOther]}>
                    {!isGrouped && (
                      <View style={[styles.senderRow, isMe ? styles.senderRowMe : styles.senderRowOther]}>
                        <Text style={[styles.senderName, { color: rgba(colors.onSurface), ...tokens.typography.labelMedium, fontWeight: '500' }]}>
                          {isMe ? identity.name : msg.userName}
                        </Text>
                        <Text style={[styles.timestamp, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelSmall }]}>
                          {formatTime(new Date(msg.timestamp))}
                        </Text>
                      </View>
                    )}

                    <View style={[
                      styles.bubble,
                      isMe
                        ? { backgroundColor: rgba(colors.primary), borderBottomRightRadius: 4 }
                        : { backgroundColor: rgba(colors.surfaceContainerHigh), borderBottomLeftRadius: 4 },
                    ]}>
                      <Text style={[
                        styles.bubbleText,
                        isMe
                          ? { color: rgba(colors.onPrimary), ...tokens.typography.bodyMedium }
                          : { color: rgba(colors.onSurface),  ...tokens.typography.bodyMedium },
                      ]}>
                        {msg.text}
                      </Text>
                    </View>

                    {isGrouped && (
                      <Text style={[styles.groupedTimestamp, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelSmall }]}>
                        {formatTime(new Date(msg.timestamp))}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* ── Input bar ── */}
          {/* Bottom inset is handled by SafeAreaView 'bottom' edge above — no paddingBottom
              here to avoid conflicting with KAV's resize-pass height calculations */}
          <View style={{ backgroundColor: rgba(colors.surface) }}>
            <View style={[styles.inputBar, { borderTopColor: rgba(colors.outlineVariant) }]}>
              <View style={[
                styles.inputRow,
                {
                  backgroundColor: rgba(colors.surfaceContainer),
                  borderColor: isConnected
                    ? rgba(colors.outlineVariant)
                    : rgba(colors.warning, 0.5),
                },
              ]}>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: rgba(colors.onSurface), ...tokens.typography.bodyMedium },
                  ]}
                  placeholder={isConnected ? 'Message #general' : 'Reconnecting...'}
                  placeholderTextColor={rgba(colors.onSurfaceVariant)}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  editable={isConnected}
                  accessibilityLabel="Message #general"
                />
                <IconButton
                  icon={(color) => <Ionicons name="send" size={16} color={color} />}
                  variant={draft.trim() && isConnected ? 'primary' : 'text'}
                  size="sm"
                  disabled={!isConnected || !draft.trim()}
                  onPress={handleSend}
                  aria-label="Send message"
                />
              </View>
              <Text style={[styles.hint, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelSmall }]}>
                Public room · Tap send to send
                {!isConnected ? ' · Offline — messages will be sent when reconnected' : ''}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ============================================================================
// STYLES — static layout only; dynamic colors are inline
// ============================================================================

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Banners
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 8, paddingHorizontal: 16,
  },
  bannerText: {},

  // Header
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineCount: {},

  // Messages
  messageList: { paddingHorizontal: 12, paddingVertical: 16, gap: 12 },
  systemMsg: { textAlign: 'center', paddingVertical: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  messageRowMe: { flexDirection: 'row-reverse' },
  messageRowOther: {},
  avatarSlot: { width: 32, flexShrink: 0, alignItems: 'center' },
  avatarSlotMe: {},
  avatarSlotOther: {},
  bubbleCol: { flexShrink: 1, maxWidth: '75%', gap: 2 },
  bubbleColMe: { alignItems: 'flex-end' },
  bubbleColOther: { alignItems: 'flex-start' },
  senderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  senderRowMe: { flexDirection: 'row-reverse' },
  senderRowOther: {},
  senderName: {},
  timestamp: {},
  bubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  bubbleText: {},
  groupedTimestamp: { paddingHorizontal: 4 },

  // Input
  inputBar: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1,
  },
  textInput: { flex: 1, maxHeight: 120, minHeight: 24, paddingVertical: 0 },
  hint: { textAlign: 'center', marginTop: 8 },
});