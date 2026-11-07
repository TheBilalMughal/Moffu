import type { Config } from 'tailwindcss';

// Admin portal uses same design tokens — denser layout than marketing/portal
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F3F0FF',
          100: '#E9E4FF',
          200: '#D8CCFF',
          300: '#B8A6FF',
          400: '#9980FF',
          500: '#6C55E8',
          600: '#5A42D1',
          700: '#4A32BA',
          800: '#3B25A3',
          900: '#2C1A8C',
        },
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
        success: { light: '#dcfce7', DEFAULT: '#16a34a', dark: '#15803d' },
        warning: { light: '#fef3c7', DEFAULT: '#d97706', dark: '#92400e' },
        danger: { light: '#fee2e2', DEFAULT: '#dc2626', dark: '#991b1b' },
        info: { light: '#dbeafe', DEFAULT: '#2563eb', dark: '#1e40af' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
