/**
 * Moffu design tokens.
 * Primary brand color: #0D4C3C (deep forest green).
 * No pill/capsule language, emoji icons, AI gradients, glowing orbs or sparkle imagery.
 */

export const colors = {
  // Brand — primary: #0D4C3C
  brand: {
    50: '#e6f2ee',
    100: '#b3d9cd',
    200: '#80c0ab',
    300: '#4da789',
    400: '#268e68',
    500: '#0D4C3C', // PRIMARY
    600: '#0b4334',
    700: '#09382b',
    800: '#072d22',
    900: '#04221a',
  },
  // Neutral
  neutral: {
    0: '#ffffff',
    50: '#f8f9fa',
    100: '#f1f3f5',
    200: '#e9ecef',
    300: '#dee2e6',
    400: '#ced4da',
    500: '#adb5bd',
    600: '#868e96',
    700: '#495057',
    800: '#343a40',
    900: '#212529',
  },
  // Semantic
  success: { light: '#d1fae5', DEFAULT: '#059669', dark: '#065f46' },
  warning: { light: '#fef3c7', DEFAULT: '#d97706', dark: '#92400e' },
  danger: { light: '#fee2e2', DEFAULT: '#dc2626', dark: '#991b1b' },
  info: { light: '#dbeafe', DEFAULT: '#2563eb', dark: '#1e40af' },
} as const;

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  // No full/pill radius — per design non-negotiables
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
} as const;
