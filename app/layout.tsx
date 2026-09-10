export const metadata = { title: 'Setu', description: 'From SRS to sprint-ready backlog' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', margin: 0, padding: '2rem', lineHeight: 1.5 }}>
        {children}
      </body>
    </html>
  )
}
