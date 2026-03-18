/**
 * Design System Tokens — Non-Color Scale
 *
 * React Native equivalent of styles/tokens.css.
 * All CSS calc()/rem/em values pre-computed to concrete dp/px
 * numbers that React Native's StyleSheet API accepts directly.
 *
 * Conversion rules:
 *   font-size:    rem * 16         → dp
 *   line-height:  ratio * fontSize → absolute dp  (RN requires absolute)
 *   letter-spacing: em * fontSize  → dp
 *   spacing:      0.25rem * n = 4dp * n
 *   duration:     unchanged ms
 *   shadow:       M3 elevation → iOS shadowProps + Android elevation
 */

const BASE = 16 as const

export const tokens = {
  typography: {
    // ========== DISPLAY — qualifies as WCAG "large text", relaxed line-height acceptable ==========
    displayLarge: {
      fontSize:      Math.round(BASE * 3.5625), // 57
      lineHeight:    Math.round(BASE * 3.5625 * 1.12),
      fontWeight:    '400' as const,
      letterSpacing: -0.9,
    },
    displayMedium: {
      fontSize:      Math.round(BASE * 2.8125), // 45
      lineHeight:    Math.round(BASE * 2.8125 * 1.16),
      fontWeight:    '400' as const,
      letterSpacing: 0,
    },
    displaySmall: {
      fontSize:      Math.round(BASE * 2.25), // 36
      lineHeight:    Math.round(BASE * 2.25 * 1.22),
      fontWeight:    '400' as const,
      letterSpacing: 0,
    },

    // ========== HEADLINE ==========
    headlineLarge: {
      fontSize:      BASE * 2,            // 32
      lineHeight:    BASE * 2 * 1.25,     // 40
      fontWeight:    '400' as const,
      letterSpacing: 0,
    },
    headlineMedium: {
      fontSize:      Math.round(BASE * 1.75),        // 28
      lineHeight:    Math.round(BASE * 1.75 * 1.29),
      fontWeight:    '400' as const,
      letterSpacing: 0,
    },
    headlineSmall: {
      fontSize:      BASE * 1.5,                     // 24
      lineHeight:    Math.round(BASE * 1.5 * 1.33),
      fontWeight:    '400' as const,
      letterSpacing: 0,
    },

    // ========== TITLE ==========
    titleLarge: {
      fontSize:      Math.round(BASE * 1.375),       // 22
      lineHeight:    Math.round(BASE * 1.375 * 1.27),
      fontWeight:    '400' as const,
      letterSpacing: 0,
    },
    titleMedium: {
      fontSize:      BASE,           // 16
      lineHeight:    BASE * 1.5,     // 24
      fontWeight:    '500' as const,
      letterSpacing: 0.15,
    },
    // Updated to 1.5 line-height per WCAG 2.2 compliance (January 2026)
    titleSmall: {
      fontSize:      Math.round(BASE * 0.875),      // 14
      lineHeight:    Math.round(BASE * 0.875 * 1.5),
      fontWeight:    '500' as const,
      letterSpacing: 0.1,
    },

    // ========== BODY — WCAG 2.2 compliant ==========
    bodyLarge: {
      fontSize:      Math.round(BASE * 1.125),      // 18
      lineHeight:    Math.round(BASE * 1.125 * 1.6),
      fontWeight:    '400' as const,
      letterSpacing: 0.28,
    },
    bodyMedium: {
      fontSize:      BASE,           // 16 — WCAG minimum for primary body text
      lineHeight:    BASE * 1.5,     // 24 — WCAG 2.1/2.2 minimum
      fontWeight:    '400' as const,
      letterSpacing: 0.25,
    },
    bodySmall: {
      fontSize:      Math.round(BASE * 0.875),      // 14 — secondary text
      lineHeight:    Math.round(BASE * 0.875 * 1.5),
      fontWeight:    '400' as const,
      letterSpacing: 0.25,
    },

    // ========== LABEL — all updated to 1.5 line-height (January 2026 audit) ==========
    labelLarge: {
      fontSize:      Math.round(BASE * 0.875),      // 14
      lineHeight:    Math.round(BASE * 0.875 * 1.5),
      fontWeight:    '500' as const,
      letterSpacing: 0.1,
    },
    labelMedium: {
      fontSize:      Math.round(BASE * 0.8125),     // 13
      lineHeight:    Math.round(BASE * 0.8125 * 1.5),
      fontWeight:    '500' as const,
      letterSpacing: 0.5,
    },
    labelSmall: {
      fontSize:      BASE * 0.75,        // 12 — minimum readable
      lineHeight:    BASE * 0.75 * 1.5,  // 18
      fontWeight:    '500' as const,
      letterSpacing: 0.5,
    },
  },

  // ============================================================
  // SPACING — 4dp base, mirrors --spacing-N from tokens.css
  // ============================================================
  spacing: {
    0:  0,
    1:  4,
    2:  8,
    3:  12,
    4:  16,
    5:  20,
    6:  24,
    7:  28,
    8:  32,
    9:  36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
    36: 144,
    40: 160,
    44: 176,
    48: 192,
    52: 208,
    56: 224,
    60: 240,
    64: 256,
    72: 288,
    80: 320,
    96: 384,
  } as const,

  // ============================================================
  // MOTION — mirrors tokens.css duration + easing scales
  // Use with: withTiming(value, { duration: tokens.motion.duration.normal,
  //                               easing: Easing.bezier(...tokens.motion.easing.standard) })
  // ============================================================
  motion: {
    duration: {
      short1:     50,
      short2:     100,
      short3:     150,
      short4:     200,
      medium1:    250,
      medium2:    300,
      medium3:    350,
      medium4:    400,
      long1:      450,
      long2:      500,
      long3:      550,
      long4:      600,
      extraLong1: 700,
      extraLong2: 800,
      extraLong3: 900,
      extraLong4: 1000,
      // Semantic aliases
      instant:  50,
      fast:     150,
      normal:   300,
      slow:     400,
      slower:   500,
      tooltip:  100,
      fade:     150,
      slide:    300,
      expand:   350,
      collapse: 300,
      modal:    350,
      page:     500,
    } as const,
    // Pass to Easing.bezier(...tokens.motion.easing.standard)
    easing: {
      linear:               [0,    0,    1,    1   ] as const,
      standard:             [0.2,  0,    0,    1   ] as const,
      standardDecelerate:   [0,    0,    0,    1   ] as const,
      standardAccelerate:   [0.3,  0,    1,    1   ] as const,
      emphasized:           [0.2,  0,    0,    1   ] as const,
      emphasizedDecelerate: [0.05, 0.7,  0.1,  1   ] as const,
      emphasizedAccelerate: [0.3,  0,    0.8,  0.15] as const,
      easeIn:               [0.4,  0,    1,    1   ] as const,
      easeOut:              [0,    0,    0.2,  1   ] as const,
      easeInOut:            [0.4,  0,    0.2,  1   ] as const,
    } as const,
  },

  // ============================================================
  // SHADOWS — M3 elevation → iOS shadow props + Android elevation
  // Spread into StyleSheet: { ...tokens.shadows.elevation2 }
  // ============================================================
  shadows: {
    elevation0: {
      shadowColor:   'transparent',
      shadowOffset:  { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius:  0,
      elevation:     0,
    },
    elevation1: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius:  2,
      elevation:     2,
    },
    elevation2: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius:  4,
      elevation:     4,
    },
    elevation3: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius:  6,
      elevation:     6,
    },
    elevation4: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius:  8,
      elevation:     8,
    },
    elevation5: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.32,
      shadowRadius:  10,
      elevation:     12,
    },
  } as const,

  // ============================================================
  // STATE LAYER OPACITY — for pressed/hover/focus overlays
  // Usage: rgba(colors.onSurface, tokens.stateOpacity.pressed)
  // ============================================================
  stateOpacity: {
    hover:             0.08,
    focus:             0.12,
    pressed:           0.12,
    dragged:           0.16,
    disabled:          0.38,
    disabledContainer: 0.12,
  } as const,

  // ============================================================
  // Z-INDEX — for absolutely positioned Views
  // ============================================================
  zIndex: {
    deep:          -999,
    base:          0,
    raised:        10,
    sticky:        100,
    fixed:         200,
    drawer:        300,
    dropdown:      400,
    modalBackdrop: 450,
    modal:         500,
    popover:       600,
    tooltip:       700,
    notification:  800,
    overlay:       900,
    max:           9999,
  } as const,
} as const

export type Tokens = typeof tokens