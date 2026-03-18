/**
 * Theme Context + Hook — Single Source of Truth for Theming
 *
 * Architecture mirrors src/contexts/ThemeContext.tsx from the web project:
 *   Web:    ThemeProvider wraps app → useTheme() reads context
 *   Native: ThemeProvider wraps <Stack /> → useTheme() reads context
 *
 * override === null             → follows useColorScheme() (OS preference)
 * override === 'light' | 'dark' → user-controlled, ignores OS preference
 *
 * Theme preference is persisted to AsyncStorage with key 'theme' — mirrors
 * the web package's localStorage strategy so the user's choice survives app restarts.
 */

import { darkColors } from '@/styles/theme/dark'
import { lightColors, rgb, rgba, type ThemeColors } from '@/styles/theme/light'
import { tokens, type Tokens } from '@/styles/tokens'
import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useColorScheme as useSystemColorScheme } from 'react-native'

export type ColorScheme = 'light' | 'dark'

interface ThemeContextValue {
  colorScheme: ColorScheme
  isSystemControlled: boolean
  loaded: boolean
  setColorScheme: (scheme: ColorScheme | 'system') => void
  toggleColorScheme: () => void
  invertedColorScheme: ColorScheme
  colors: ThemeColors
  tokens: Tokens
  rgba: typeof rgba
  rgb: typeof rgb
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme()

  // null = defer to OS; non-null = user override
  const [override, setOverride] = useState<ColorScheme | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load persisted theme preference once on mount — AsyncStorage is async so it
  // cannot be used as a synchronous useState initializer like web's localStorage.
  // Rendering with the system default first avoids blocking startup on the storage read.
  useEffect(() => {
    AsyncStorage.getItem('theme')
      .then(stored => {
        if (stored === 'light' || stored === 'dark') {
          setOverride(stored)
        }
      })
      .catch(err => console.error('Failed to read theme from AsyncStorage:', err))
      .finally(() => setLoaded(true))
  }, [])

  // useColorScheme() can return null before the OS reports — default to 'light'
  // to match the web project's light-first default
  const resolvedSystem: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light'
  const colorScheme: ColorScheme = override ?? resolvedSystem

  // Resolve palette here so every useTheme() consumer gets the switched palette
  // without branching on colorScheme themselves — mirrors how Tailwind classes
  // automatically reflect the active CSS variable set
  const colors = colorScheme === 'dark' ? darkColors : lightColors

  function setColorScheme(scheme: ColorScheme | 'system') {
    const resolved = scheme === 'system' ? null : scheme
    setOverride(resolved)
    // Persist user choice so it survives app restarts — mirrors web's saveTheme()
    if (resolved !== null) {
      AsyncStorage.setItem('theme', resolved).catch(err =>
        console.error('Failed to save theme to AsyncStorage:', err)
      )
    } else {
      // 'system' selected — remove the stored key so OS preference applies on next launch
      AsyncStorage.removeItem('theme').catch(err =>
        console.error('Failed to clear theme from AsyncStorage:', err)
      )
    }
  }
  // Inversion logic lives here so _layout and index don't each own a copy of the ternary
  function toggleColorScheme() {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
  }
  // Pre-computed so StatusBar (style prop) and any future consumers read one source of truth
  const invertedColorScheme: ColorScheme = colorScheme === 'dark' ? 'light' : 'dark'

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        isSystemControlled: override === null,
        setColorScheme,
        toggleColorScheme,
        invertedColorScheme,
        colors,
        tokens,
        rgba,
        rgb,
        loaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Primary theme consumption hook — the only import components need.
 *
 * Usage:
 *   const { colors, tokens, rgba, colorScheme, setColorScheme, toggleColorScheme, invertedColorScheme } = useTheme()
 *   style={{ backgroundColor: rgba(colors.surface) }}
 *   style={{ backgroundColor: rgba(colors.primary, 0.1) }}  // 10% tint
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be called inside <ThemeProvider>')
  }
  return ctx
}
