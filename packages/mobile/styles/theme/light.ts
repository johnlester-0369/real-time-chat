/**
 * Light Theme Palette — Single Source of Truth
 *
 * React Native equivalent of styles/theme/light.css.
 * ColorTuple values copied verbatim from the CSS file
 * (space-separated R G B → readonly [R, G, B] tuple).
 *
 * ColorTuple and helpers live here because light is the
 * default/base palette — dark.ts imports ColorTuple from here,
 * mirroring how light.css defines the :root reference layer.
 */

export type ColorTuple = readonly [number, number, number]

/** Mirrors CSS: rgb(var(--color-*) / alpha) */
export function rgba(color: ColorTuple, alpha = 1): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

/** Solid rgb() without alpha — convenience for fully-opaque colors */
export function rgb(color: ColorTuple): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
}

// ============================================================
// LIGHT PALETTE — mirrors :root { --light-color-* } in light.css
// ============================================================
export const lightColors = {
  // ==================== PRIMARY ====================
  primary:              [68,  114, 210] as ColorTuple,
  onPrimary:            [255, 255, 255] as ColorTuple,
  primaryContainer:     [221, 232, 254] as ColorTuple,
  onPrimaryContainer:   [26,  48,  95]  as ColorTuple,

  // ==================== SECONDARY ====================
  secondary:            [126, 93,  209] as ColorTuple,
  onSecondary:          [255, 255, 255] as ColorTuple,
  secondaryContainer:   [232, 228, 254] as ColorTuple,
  onSecondaryContainer: [54,  38,  94]  as ColorTuple,

  // ==================== TERTIARY ====================
  tertiary:             [168, 72,  181] as ColorTuple,
  onTertiary:           [255, 255, 255] as ColorTuple,
  tertiaryContainer:    [247, 222, 250] as ColorTuple,
  onTertiaryContainer:  [75,  28,  81]  as ColorTuple,

  // ==================== SURFACE SYSTEM ====================
  surface:                 [255, 255, 255] as ColorTuple,
  onSurface:               [0,   0,   0]   as ColorTuple,
  surfaceVariant:          [202, 213, 226] as ColorTuple,
  onSurfaceVariant:        [50,  65,  87]  as ColorTuple,
  surfaceContainerLowest:  [255, 255, 255] as ColorTuple,
  surfaceContainerLow:     [248, 250, 252] as ColorTuple,
  surfaceContainer:        [241, 245, 249] as ColorTuple,
  surfaceContainerHigh:    [227, 233, 241] as ColorTuple,
  surfaceContainerHighest: [212, 221, 232] as ColorTuple,
  surfaceBright:           [255, 255, 255] as ColorTuple,
  surfaceDim:              [144, 161, 185] as ColorTuple,

  // ==================== INVERSE ====================
  inverseSurface:   [29,  41,  58]  as ColorTuple,
  inverseOnSurface: [248, 250, 252] as ColorTuple,
  inversePrimary:   [196, 216, 253] as ColorTuple,

  // ==================== OUTLINE ====================
  outline:        [98,  116, 142] as ColorTuple,
  outlineVariant: [144, 161, 185] as ColorTuple,

  // ==================== SCRIM & SHADOW ====================
  scrim:  [0, 0, 0] as ColorTuple,
  shadow: [0, 0, 0] as ColorTuple,

  // ==================== ERROR ====================
  error:            [231, 0,   11]  as ColorTuple,
  onError:          [254, 242, 242] as ColorTuple,
  errorContainer:   [255, 226, 226] as ColorTuple,
  onErrorContainer: [130, 24,  26]  as ColorTuple,

  // ==================== SUCCESS ====================
  success:            [0,   130, 54]  as ColorTuple,
  onSuccess:          [240, 253, 244] as ColorTuple,
  successContainer:   [220, 252, 231] as ColorTuple,
  onSuccessContainer: [13,  84,  43]  as ColorTuple,

  // ==================== WARNING ====================
  warning:            [225, 113, 0]   as ColorTuple,
  onWarning:          [255, 251, 235] as ColorTuple,
  warningContainer:   [254, 243, 198] as ColorTuple,
  onWarningContainer: [123, 51,  6]   as ColorTuple,

  // ==================== INFO ====================
  info:            [0,   132, 209] as ColorTuple,
  onInfo:          [240, 249, 255] as ColorTuple,
  infoContainer:   [223, 242, 254] as ColorTuple,
  onInfoContainer: [2,   74,  112] as ColorTuple,
} as const

/** Shared palette shape — useful for typed component props */
export type ThemeColors = typeof lightColors