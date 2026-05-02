import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import BottomNavbar from '@/components/layout/BottomNavbar'
import NotificationBanner from '@/components/layout/NotificationBanner'
import OfflineBanner from '@/components/common/OfflineBanner'
import OfflinePromptModal from '@/components/common/OfflinePromptModal'
import OnlinePromptModal from '@/components/common/OnlinePromptModal'
import { css } from 'styled-system/css'
import { GoogleAnalytics } from '@next/third-parties/google'
import NativeAnalytics from '@/components/common/NativeAnalytics'
import { SpeedInsights } from "@vercel/speed-insights/next"
import BugReportFAB from '@/components/layout/BugReportFAB'
import UpdateOverlay from '@/components/layout/UpdateOverlay'
import GlobalModals from '@/components/layout/GlobalModals'

export const metadata: Metadata = {
  title: '온여정 - 당신의 따뜻한 여행 동반자',
  description: '설레는 여행의 모든 순간, 온여정과 함께하세요. 일정표 작성부터 체크리스트까지 한 곳에서 관리하는 여행 앱',
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
        {/*
          전역 레이아웃
          TODO: 인증 여부에 따라 Navbar 표시 속성 변경 처리 가능
        */}
        <SpeedInsights />
        <OfflineBanner />
        <OfflinePromptModal />
        <OnlinePromptModal />
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
        <UpdateOverlay />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
        <NativeAnalytics />
        <GlobalModals />
      </body>
    </html>
  )
}
