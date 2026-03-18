/**
 * IconButton — React Native equivalent of web's IconButton.tsx
 *
 * Key differences from the web version:
 * - Pressable replaces polymorphic HTML element (no `as` prop needed in RN)
 * - icon prop is a render function (color: string) => ReactNode instead of ReactNode,
 *   because RN has no CSS `currentColor` inheritance — the button must inject the
 *   correct icon color based on its computed variant state
 * - State layers use Pressable's pressed callback instead of CSS ::after pseudo-elements
 * - StyleSheet replaces Tailwind classes; colors sourced from ThemeContext tokens
 */

import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================================================
// TYPES
// ============================================================================

export type IconButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'outline'
  | 'text'
  | 'danger';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  /** Render function receives the computed icon color — avoids CSS currentColor dependency */
  icon: (color: string) => React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** hitSlop extends touch target without changing visible size — important for small sm buttons */
  hitSlop?: number;
  'aria-label'?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DIMENSION: Record<IconButtonSize, number> = { sm: 32, md: 40, lg: 48 };
const ICON_SIZE: Record<IconButtonSize, number> = { sm: 16, md: 20, lg: 24 };

// ============================================================================
// COMPONENT
// ============================================================================

export default function IconButton({
  icon,
  variant = 'text',
  size = 'md',
  isLoading = false,
  disabled,
  onPress,
  hitSlop,
}: IconButtonProps) {
  const { colors, rgba } = useTheme();
  const isDisabled = disabled === true || isLoading;
  const dimension = DIMENSION[size];
  const iconSize = ICON_SIZE[size];

  function getBg(pressed: boolean): string {
    const pressedOpacity = 0.12;
    const hoverOpacity = 0.08; // pressed state substitutes for hover on touch
    switch (variant) {
      case 'primary':   return pressed ? rgba(colors.primary, 0.85) : rgba(colors.primary);
      case 'secondary': return pressed ? rgba(colors.secondary, 0.85) : rgba(colors.secondary);
      case 'tertiary':  return pressed ? rgba(colors.tertiary, 0.85) : rgba(colors.tertiary);
      case 'danger':    return pressed ? rgba(colors.error, 0.85) : rgba(colors.error);
      case 'outline':   return pressed ? rgba(colors.onSurface, pressedOpacity) : 'transparent';
      case 'text':
      default:          return pressed ? rgba(colors.onSurface, hoverOpacity) : 'transparent';
    }
  }

  function getIconColor(): string {
    switch (variant) {
      case 'primary':   return rgba(colors.onPrimary);
      case 'secondary': return rgba(colors.onSecondary);
      case 'tertiary':  return rgba(colors.onTertiary);
      case 'danger':    return rgba(colors.onError);
      default:          return rgba(colors.onSurface);
    }
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.base,
        {
          width: dimension,
          height: dimension,
          backgroundColor: getBg(pressed),
          opacity: isDisabled ? 0.38 : 1,
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: variant === 'outline' ? rgba(colors.outline) : 'transparent',
        },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.inner}>
        {isLoading ? (
          <ActivityIndicator size={iconSize} color={getIconColor()} />
        ) : (
          icon(getIconColor())
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});