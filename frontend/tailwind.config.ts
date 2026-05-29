import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-subtle': 'var(--fg-subtle)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ring: 'var(--ring)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'on-primary': 'var(--on-primary)',
        'primary-soft': 'var(--primary-soft)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)'
      },
      spacing: {
        // Tailwind spacing already aligns with 4pt rhythm; expose DS-named tokens for clarity
        'ds-1': 'var(--space-1)',
        'ds-2': 'var(--space-2)',
        'ds-3': 'var(--space-3)',
        'ds-4': 'var(--space-4)',
        'ds-5': 'var(--space-5)',
        'ds-6': 'var(--space-6)',
        'ds-8': 'var(--space-8)',
        'ds-10': 'var(--space-10)',
        'ds-12': 'var(--space-12)',
        'ds-16': 'var(--space-16)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      boxShadow: {
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)'
      },
      width: {
        '46': '11.5rem'
      }
    }
  },
  plugins: []
} satisfies Config
