/**
 * Dark Theme Palette
 *
 * React Native equivalent of styles/theme/dark.css.
 * Imports ColorTuple from light.ts — the base palette file —
 * mirroring how dark.css overrides the :root reference layer
 * defined in light.css.
 */

import type { ColorTuple } from './light'

// ============================================================
// DARK PALETTE — mirrors :root { --dark-color-* } in dark.css
// ============================================================
export const darkColors = {
  // ==================== PRIMARY ====================
  primary:              [196, 216, 253] as ColorTuple,
  onPrimary:            [14,  30,  62]  as ColorTuple,
  primaryContainer:     [51,  87,  162] as ColorTuple,
  onPrimaryContainer:   [221, 232, 254] as ColorTuple,

  // ==================== SECONDARY ====================
  secondary:            [216, 209, 253] as ColorTuple,
  onSecondary:          [33,  23,  61]  as ColorTuple,
  secondaryContainer:   [96,  71,  161] as ColorTuple,
  onSecondaryContainer: [232, 228, 254] as ColorTuple,

  // ==================== TERTIARY ====================
  tertiary:             [244, 197, 249] as ColorTuple,
  onTertiary:           [48,  15,  52]  as ColorTuple,
  tertiaryContainer:    [129, 54,  139] as ColorTuple,
  onTertiaryContainer:  [247, 222, 250] as ColorTuple,

  // ==================== SURFACE SYSTEM ====================
  surface:                 [31,  43,  61]  as ColorTuple,
  onSurface:               [255, 255, 255] as ColorTuple,
  surfaceVariant:          [50,  65,  87]  as ColorTuple,
  onSurfaceVariant:        [202, 213, 226] as ColorTuple,
  surfaceContainerLowest:  [31,  43,  61]  as ColorTuple,
  surfaceContainerLow:     [23,  32,  49]  as ColorTuple,
  surfaceContainer:        [20,  28,  44]  as ColorTuple,
  surfaceContainerHigh:    [16,  24,  40]  as ColorTuple,
  surfaceContainerHighest: [3,   7,   18]  as ColorTuple,
  surfaceBright:           [98,  116, 142] as ColorTuple,
  surfaceDim:              [3,   7,   18]  as ColorTuple,

  // ==================== INVERSE ====================
  inverseSurface:   [241, 245, 249] as ColorTuple,
  inverseOnSurface: [29,  41,  58]  as ColorTuple,
  inversePrimary:   [68,  114, 210] as ColorTuple,

  // ==================== OUTLINE ====================
  outline:        [144, 161, 185] as ColorTuple,
  outlineVariant: [69,  85,  108] as ColorTuple,

  // ==================== SCRIM & SHADOW ====================
  scrim:  [0, 0, 0] as ColorTuple,
  shadow: [0, 0, 0] as ColorTuple,

  // ==================== ERROR ====================
  error:            [255, 100, 103] as ColorTuple,
  onError:          [70,  8,   9]   as ColorTuple,
  errorContainer:   [130, 24,  26]  as ColorTuple,
  onErrorContainer: [255, 226, 226] as ColorTuple,

  // ==================== SUCCESS ====================
  success:            [5,   223, 114] as ColorTuple,
  onSuccess:          [3,   46,  21]  as ColorTuple,
  successContainer:   [13,  84,  43]  as ColorTuple,
  onSuccessContainer: [220, 252, 231] as ColorTuple,

  // ==================== WARNING ====================
  warning:            [255, 185, 0]   as ColorTuple,
  onWarning:          [70,  25,  1]   as ColorTuple,
  warningContainer:   [151, 60,  0]   as ColorTuple,
  onWarningContainer: [254, 243, 198] as ColorTuple,

  // ==================== INFO ====================
  info:            [0,   188, 255] as ColorTuple,
  onInfo:          [5,   47,  74]  as ColorTuple,
  infoContainer:   [2,   74,  112] as ColorTuple,
  onInfoContainer: [223, 242, 254] as ColorTuple,
} as const