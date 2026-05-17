import type { Metadata, Viewport } from 'next'
import { WorkspaceProvider } from '@/app/context/workspace-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'SOON Core',
  description: 'SOON production pipeline dashboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SOON Core',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-HK">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  )
}
