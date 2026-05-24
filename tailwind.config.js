/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  safelist: [
    'translate-x-0',
    '-translate-x-full',
    'lg:translate-x-0',
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// RingMinder design tokens
  			background: '#F4F6F9',
  			surface: '#FFFFFF',
  			border: '#E2E6EC',
  			sidebar: {
  				bg: '#152438',
  				text: '#8899AA',
  				active: '#4ECDC4',
  			},
  			primary: {
  				DEFAULT: '#4ECDC4',
  				foreground: '#1A2B42',
  			},
  			text: {
  				DEFAULT: '#1A2B42',
  				muted: '#6B7A90',
  			},
  			destructive: {
  				DEFAULT: '#E05555',
  				foreground: '#ffffff',
  			},
  			success: '#3DBE6E',
  			warning: '#E8A838',
  			// shadcn semantic tokens (required by shadcn components)
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))',
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))',
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))',
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))',
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

