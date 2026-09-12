export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#5B5CF6',700:'#4f46e5',800:'#4338ca',900:'#312e81' },
        accent: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#19C7A3',600:'#10b981',700:'#059669',800:'#047857' },
        signal: { 50:'#ecfeff',100:'#cffafe',200:'#a5f3fc',300:'#67e8f9',400:'#22D3EE',500:'#06b6d4',600:'#0891b2',700:'#0e7490' },
        warning: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f4b942',600:'#d97706',700:'#b45309' },
        error: { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c' },
        neutral: { 50:'#f6f7fb',100:'#eef0f5',200:'#dfe3eb',300:'#c8ceda',400:'#929bad',500:'#667085',600:'#475467',700:'#344054',800:'#1d2939',900:'#0B1020' }
      },
      fontFamily: {
        sans:['DM Sans','IBM Plex Sans Arabic','system-ui','sans-serif'],
        display:['Space Grotesk','IBM Plex Sans Arabic','system-ui','sans-serif'],
        arabic:['IBM Plex Sans Arabic','DM Sans','system-ui','sans-serif']
      }
    }
  },
  plugins: []
}
