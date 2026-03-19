/**
 * NameEntryScreen — React Native equivalent of web's NameEntryScreen.tsx
 *
 * Identical validation logic and props contract.
 * Key RN adaptations:
 * - KeyboardAvoidingView + ScrollView so the form stays visible when the
 *   software keyboard opens (critical for centered login screens)
 * - TextInput replaces <input type="text">; keyboardType and returnKeyType
 *   give mobile-native affordances
 * - Ionicons replaces lucide-react's MessageCircle
 * - Identity persistence is the parent's responsibility (app/index.tsx uses
 *   AsyncStorage), keeping this screen stateless about storage — same as web
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, ScrollView, Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================================================
// CONSTANTS & VALIDATION
// ============================================================================

const NAME_MIN = 2;
const NAME_MAX = 32;

function validateName(raw: string): string {
  const v = raw.trim();
  if (!v) return 'Display name is required.';
  if (v.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters.`;
  if (v.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or less.`;
  return '';
}

// ============================================================================
// PROPS
// ============================================================================

export interface NameEntryScreenProps {
  onNameSubmit: (name: string) => void;
  isConnected: boolean;
  /** Server-side join rejection error (e.g. name already taken) */
  serverError?: string | null;
  onClearServerError?: () => void;
  /** Live count from room:history so the user can see activity before joining */
  onlineCount?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function NameEntryScreen({
  onNameSubmit,
  isConnected,
  serverError,
  onClearServerError,
  onlineCount = 0,
}: NameEntryScreenProps) {
  const { colors, tokens, rgba } = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  function handleSubmit() {
    const err = validateName(value);
    if (err) {
      setError(err);
      setTouched(true);
      return;
    }
    onNameSubmit(value.trim());
  }

  const activeError = serverError ?? error;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: rgba(colors.surface) }]}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* Icon + heading */}
          <View style={styles.hero}>
            <View style={[
              styles.iconWrap,
              {
                backgroundColor: rgba(colors.primaryContainer),
                // elevation-2 equivalent
                ...tokens.shadows.elevation2,
              },
            ]}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={rgba(colors.onPrimaryContainer)} />
            </View>
            <View style={styles.headingGroup}>
              <Text style={[styles.heading, { color: rgba(colors.onSurface), ...tokens.typography.headlineMedium }]}>
                Welcome to Chat
              </Text>
              <Text style={[styles.subheading, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.bodyMedium }]}>
                Choose a display name to join the conversation
              </Text>
            </View>
          </View>

          {/* Card */}
          <View style={[
            styles.card,
            {
              backgroundColor: rgba(colors.surfaceContainerLow),
              ...tokens.shadows.elevation1,
            },
          ]}>

            {/* Label + Input */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: rgba(colors.onSurface), ...tokens.typography.labelLarge }]}>
                Display Name
              </Text>
              <TextInput
                value={value}
                onChangeText={text => {
                  setValue(text);
                  if (touched) setError(validateName(text));
                  // Clear server-side name-taken error so the user can attempt a different name
                  onClearServerError?.();
                }}
                onBlur={() => {
                  setTouched(true);
                  setError(validateName(value));
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
                placeholder="e.g. Alex Chen"
                placeholderTextColor={rgba(colors.onSurfaceVariant)}
                maxLength={NAME_MAX}
                autoFocus
                autoCorrect={false}
                autoCapitalize="words"
                style={[
                  styles.input,
                  {
                    backgroundColor: rgba(colors.surfaceContainer),
                    color: rgba(colors.onSurface),
                    borderColor: activeError
                      ? rgba(colors.error)
                      : rgba(colors.outlineVariant),
                    ...tokens.typography.bodyMedium,
                  },
                ]}
                accessibilityLabel="Display Name"
                accessibilityHint="Enter a name between 2 and 32 characters"
              />

              {/* Error + character count row */}
              <View style={styles.metaRow}>
                {activeError ? (
                  <Text style={[styles.errorText, { color: rgba(colors.error), ...tokens.typography.labelSmall }]}>
                    {activeError}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={[styles.charCount, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelSmall }]}>
                  {value.length}/{NAME_MAX}
                </Text>
              </View>
            </View>

            {/* Connection status */}
            <View style={styles.statusRow}>
              <View style={[
                styles.dot,
                { backgroundColor: isConnected ? rgba(colors.success) : rgba(colors.warning) },
              ]} />
              <Text style={[styles.statusText, {
                color: isConnected ? rgba(colors.success) : rgba(colors.onSurfaceVariant),
                ...tokens.typography.labelMedium,
              }]}>
                {isConnected ? 'Server connected' : 'Connecting to server...'}
              </Text>
              {isConnected && (
                <Text style={[styles.statusText, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelMedium }]}>
                  {' · '}{onlineCount} online
                </Text>
              )}
            </View>

            {/* Join button */}
            <Pressable
              onPress={handleSubmit}
              disabled={!value.trim()}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: value.trim()
                    ? pressed ? rgba(colors.primary, 0.85) : rgba(colors.primary)
                    : rgba(colors.primary, 0.38),
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Join Chat"
            >
              <Text style={[styles.buttonLabel, { color: rgba(colors.onPrimary), ...tokens.typography.labelLarge }]}>
                Join Chat
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: rgba(colors.onSurfaceVariant), ...tokens.typography.labelSmall }]}>
            Your name is stored on this device — no account required
          </Text>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
    maxWidth: 384,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: 16, marginBottom: 32 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  headingGroup: { alignItems: 'center', gap: 4 },
  heading: { textAlign: 'center', fontWeight: '600' },
  subheading: { textAlign: 'center' },
  card: { width: '100%', borderRadius: 24, padding: 24, gap: 20 },
  fieldGroup: { gap: 6 },
  label: { fontWeight: '500' },
  input: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: {},
  charCount: {},
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {},
  button: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonLabel: { fontWeight: '500' },
  hint: { textAlign: 'center', marginTop: 16 },
});
