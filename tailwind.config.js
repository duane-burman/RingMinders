/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
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
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

