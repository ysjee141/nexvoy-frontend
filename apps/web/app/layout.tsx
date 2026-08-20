import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import BottomNavbar from '@/components/layout/BottomNavbar'
import NotificationBanner from '@/components/layout/NotificationBanner'
import OfflineBanner from '@/components/common/OfflineBanner'
import { css } from 'styled-system/css'
import { GoogleAnalytics } from '@next/third-parties/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import BugReportFAB from '@/components/layout/BugReportFAB'
import GlobalModals from '@/components/layout/GlobalModals'
import ToastContainer from '@/components/common/ToastContainer'
import LegacyV1Reset from '@/components/system/LegacyV1Reset'

export const metadata: Metadata = {
  title: '갈래 - 함께 만드는 여행',
  description: '계획부터 기록까지, 함께 만드는 여행. 갈래에서 동행자와 여행의 방향을 정해보세요.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body
        className={css({
          minH: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bg: 'bg.canvas',
          color: 'brand.secondary',
        })}
      >
        <SpeedInsights />
        <LegacyV1Reset />
        <OfflineBanner />
        <Navbar />
        <NotificationBanner />
        <main
          className={css({
            flex: 1,
            w: '100%',
            maxW: '1280px',
            mx: 'auto',
            p: {
              base: 'calc(64px + max(env(safe-area-inset-top), var(--safe-area-inset-top))) 16px calc(80px + max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom)))',
              md: 'calc(88px + max(env(safe-area-inset-top), var(--safe-area-inset-top))) 24px 32px'
            },
          })}
        >
          {children}
        </main>
        <BottomNavbar />
        <BugReportFAB />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
        <GlobalModals />
        <ToastContainer />
      </body>
    </html>
  )
}
