import type { Config } from 'tailwindcss';

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
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#111827',
          600: '#1f2937',
          700: '#374151',
          800: '#4b5563',
          900: '#6b7280',
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
        success: { light: '#d1fae5', DEFAULT: '#059669', dark: '#065f46' },
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
