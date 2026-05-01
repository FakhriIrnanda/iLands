import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GNSS Early Warning Dashboard',
  description: 'AI-Assisted Real-Time GNSS Monitoring & Landslide Early Warning System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
