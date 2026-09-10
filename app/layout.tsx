import './globals.css'
import { ThemeScript } from '@/components/theme-switcher.tsx'

export const metadata = { title: 'Setu', description: 'From SRS to sprint-ready backlog' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body>{children}</body>
    </html>
  )
}
