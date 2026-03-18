/**
 * Status — React Native compound component
 *
 * Mirrors web's Status.tsx (Root + Indicator) without Tailwind.
 * Pulse animation uses React Native's Animated API — no Reanimated
 * dependency needed for a simple opacity loop.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { ColorTuple } from '@/styles/theme/light';

// ============================================================================
// TYPES
// ============================================================================

export type StatusColor =
  | 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary';

export type StatusSize = 'sm' | 'md' | 'lg';

// ============================================================================
// STYLE MAPS
// ============================================================================

const INDICATOR_DIMENSION: Record<StatusSize, number> = { sm: 6, md: 8, lg: 10 };
const TEXT_SIZE: Record<StatusSize, number> = { sm: 12, md: 14, lg: 16 };
const GAP: Record<StatusSize, number> = { sm: 6, md: 8, lg: 10 };

// ============================================================================
// INDICATOR COMPONENT
// ============================================================================

export interface StatusIndicatorProps {
  colorPalette?: StatusColor;
  size?: StatusSize;
  pulse?: boolean;
}

function StatusIndicator({
  colorPalette = 'success',
  size = 'md',
  pulse = false,
}: StatusIndicatorProps) {
  const { colors, rgba } = useTheme();
  // Opacity animation ref — reset to 1 when pulse is disabled so the indicator
  // stays fully opaque in the disconnected/static state
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse) {
      // Loop between full opacity and ~40% to create a gentle breathing effect
      // matching the web's `animate-pulse` Tailwind class (which uses opacity 1→0.4)
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,   duration: 1000, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      opacity.stopAnimation();
      opacity.setValue(1);
    }
  }, [pulse, opacity]);

  const colorMap: Record<StatusColor, ColorTuple> = {
    success:   colors.success,
    error:     colors.error,
    warning:   colors.warning,
    info:      colors.info,
    primary:   colors.primary,
    secondary: colors.secondary,
  };

  const dimension = INDICATOR_DIMENSION[size];

  return (
    <Animated.View
      style={[
        styles.indicator,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: rgba(colorMap[colorPalette]),
          opacity,
        },
      ]}
      accessibilityElementsHidden
    />
  );
}

// ============================================================================
// ROOT COMPONENT
// ============================================================================

export interface StatusRootProps {
  colorPalette?: StatusColor;
  size?: StatusSize;
  children?: React.ReactNode;
  style?: object;
}

function StatusRoot({
  colorPalette = 'success',
  size = 'md',
  children,
  style,
}: StatusRootProps) {
  const { colors, rgba } = useTheme();

  const colorMap: Record<StatusColor, ColorTuple> = {
    success:   colors.success,
    error:     colors.error,
    warning:   colors.warning,
    info:      colors.info,
    primary:   colors.primary,
    secondary: colors.secondary,
  };

  return (
    <View style={[styles.root, { gap: GAP[size] }, style]}>
      <Text style={{ fontSize: TEXT_SIZE[size], fontWeight: '500', color: rgba(colorMap[colorPalette]) }}>
        {children}
      </Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  indicator: {
    flexShrink: 0,
  },
  root: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// ============================================================================
// COMPOUND EXPORT
// ============================================================================

const Status = {
  Root: StatusRoot,
  Indicator: StatusIndicator,
};

export default Status;