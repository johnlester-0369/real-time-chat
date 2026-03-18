/**
 * Avatar — React Native compound component
 *
 * Mirrors web's Avatar.tsx structure (Root/Image/Fallback/Group) without
 * the polymorphic `as` prop pattern — RN components have fixed element types.
 * Color resolution uses the ThemeColors tuple system from @/styles/theme/light
 * rather than Tailwind classes.
 */

import React, { useState, createContext, useContext } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors, ColorTuple } from '@/styles/theme/light';

// ============================================================================
// TYPES
// ============================================================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type AvatarVariant = 'solid' | 'subtle' | 'outline';
export type AvatarColor =
  | 'primary' | 'secondary' | 'tertiary'
  | 'success' | 'error' | 'warning' | 'info' | 'neutral';

type ResolvedColors = { bg: string; text: string; border?: string };

type AvatarContextValue = {
  size: AvatarSize;
  name?: string;
  imageLoaded: boolean;
  imageError: boolean;
  setImageLoaded: (v: boolean) => void;
  setImageError: (v: boolean) => void;
  resolved: ResolvedColors;
};

// ============================================================================
// CONTEXT
// ============================================================================

const AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatarContext() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error('Avatar sub-components must be used within Avatar.Root');
  return ctx;
}

// ============================================================================
// STYLE MAPS
// ============================================================================

const DIMENSION: Record<AvatarSize, number> = {
  xs: 24, sm: 32, md: 40, lg: 48, xl: 64, '2xl': 80,
};

const FONT_SIZE: Record<AvatarSize, number> = {
  xs: 10, sm: 12, md: 14, lg: 16, xl: 20, '2xl': 24,
};

const ICON_SIZE: Record<AvatarSize, number> = {
  xs: 12, sm: 16, md: 20, lg: 24, xl: 32, '2xl': 40,
};

// ============================================================================
// COLOR RESOLUTION
// ============================================================================

/**
 * Resolves background, text and optional border colors from the theme palette.
 * Replaces the web's CSS Tailwind class maps — same semantic mapping, RN colors.
 */
function getAvatarColors(
  variant: AvatarVariant,
  color: AvatarColor,
  colors: ThemeColors,
  rgba: (c: ColorTuple, a?: number) => string,
): ResolvedColors {
  if (variant === 'solid') {
    const map: Record<AvatarColor, [ColorTuple, ColorTuple]> = {
      primary:   [colors.primary,              colors.onPrimary],
      secondary: [colors.secondary,            colors.onSecondary],
      tertiary:  [colors.tertiary,             colors.onTertiary],
      success:   [colors.success,              colors.onSuccess],
      error:     [colors.error,                colors.onError],
      warning:   [colors.warning,              colors.onWarning],
      info:      [colors.info,                 colors.onInfo],
      neutral:   [colors.surfaceContainerHigh, colors.onSurface],
    };
    const [bg, text] = map[color];
    return { bg: rgba(bg), text: rgba(text) };
  }

  if (variant === 'subtle') {
    const map: Record<AvatarColor, [ColorTuple, ColorTuple]> = {
      primary:   [colors.primaryContainer,   colors.onPrimaryContainer],
      secondary: [colors.secondaryContainer, colors.onSecondaryContainer],
      tertiary:  [colors.tertiaryContainer,  colors.onTertiaryContainer],
      success:   [colors.successContainer,   colors.onSuccessContainer],
      error:     [colors.errorContainer,     colors.onErrorContainer],
      warning:   [colors.warningContainer,   colors.onWarningContainer],
      info:      [colors.infoContainer,      colors.onInfoContainer],
      neutral:   [colors.surfaceContainer,   colors.onSurfaceVariant],
    };
    const [bg, text] = map[color];
    return { bg: rgba(bg), text: rgba(text) };
  }

  // outline variant — transparent bg, colored border and text
  const borderMap: Record<AvatarColor, ColorTuple> = {
    primary:   colors.primary,
    secondary: colors.secondary,
    tertiary:  colors.tertiary,
    success:   colors.success,
    error:     colors.error,
    warning:   colors.warning,
    info:      colors.info,
    neutral:   colors.outline,
  };
  const borderColor = borderMap[color];
  return {
    bg: 'transparent',
    text: color === 'neutral' ? rgba(colors.onSurface) : rgba(borderColor),
    border: rgba(borderColor),
  };
}

// ============================================================================
// UTILITY
// ============================================================================

function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return ((parts[0] ?? '').charAt(0) + (parts[parts.length - 1] ?? '').charAt(0)).toUpperCase();
}

// ============================================================================
// ROOT COMPONENT
// ============================================================================

export interface AvatarRootProps {
  size?: AvatarSize;
  variant?: AvatarVariant;
  color?: AvatarColor;
  name?: string;
  children?: React.ReactNode;
  style?: object;
}

function AvatarRoot({
  size = 'md',
  variant = 'subtle',
  color = 'primary',
  name,
  children,
  style,
}: AvatarRootProps) {
  const { colors, rgba } = useTheme();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const resolved = getAvatarColors(variant, color, colors, rgba);
  const dimension = DIMENSION[size];

  return (
    <AvatarContext.Provider
      value={{ size, name, imageLoaded, imageError, setImageLoaded, setImageError, resolved }}
    >
      <View
        style={[
          styles.root,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            backgroundColor: resolved.bg,
            borderWidth: resolved.border ? 2 : 0,
            borderColor: resolved.border ?? 'transparent',
          },
          style,
        ]}
      >
        {children}
      </View>
    </AvatarContext.Provider>
  );
}

// ============================================================================
// FALLBACK COMPONENT
// ============================================================================

export interface AvatarFallbackProps {
  children?: React.ReactNode;
}

function AvatarFallback({ children }: AvatarFallbackProps) {
  const { size, name, imageLoaded, resolved } = useAvatarContext();
  // Hide fallback once image loads successfully
  if (imageLoaded) return null;

  const initials = getInitials(name);
  const fontSize = FONT_SIZE[size];

  return (
    <View style={styles.fallback}>
      {children ?? (
        initials ? (
          <Text style={[styles.initials, { fontSize, color: resolved.text, fontWeight: '600' }]}>
            {initials}
          </Text>
        ) : (
          // Inline SVG-like circle placeholder when no name — renders a simple dot glyph
          <Text style={{ fontSize: ICON_SIZE[size], color: resolved.text }}>◉</Text>
        )
      )}
    </View>
  );
}

// ============================================================================
// IMAGE COMPONENT
// ============================================================================

export interface AvatarImageProps {
  src?: string;
  alt?: string;
}

function AvatarImage({ src }: AvatarImageProps) {
  const { setImageLoaded, setImageError, imageError } = useAvatarContext();
  if (!src || imageError) return null;

  return (
    <Image
      source={{ uri: src }}
      style={StyleSheet.absoluteFill}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageError(true)}
    />
  );
}

// ============================================================================
// GROUP COMPONENT
// ============================================================================

export interface AvatarGroupProps {
  children?: React.ReactNode;
  overlap?: number;
  style?: object;
}

function AvatarGroup({ children, overlap = 8, style }: AvatarGroupProps) {
  const items = React.Children.toArray(children);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, index) => (
        <View key={index} style={{ marginLeft: index === 0 ? 0 : -overlap }}>
          {child}
        </View>
      ))}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    textAlign: 'center',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// ============================================================================
// COMPOUND EXPORT
// ============================================================================

const Avatar = {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
  Group: AvatarGroup,
};

export default Avatar;