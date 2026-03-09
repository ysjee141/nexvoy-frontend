import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import NotificationBanner from '@/components/layout/NotificationBanner'
import { css } from 'styled-system/css'

export const metadata: Metadata = {
  title: 'Next Voyage - 당신의 친절한 여행 동반자',
  description: '일정표 작성부터 체크리스트까지 한 곳에서 관리하는 여행 앱',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
          bg: '#fbfbfb',
        })}
      >
        {/*
          전역 레이아웃
          TODO: 인증 여부에 따라 Navbar 표시 속성 변경 처리 가능
        */}
        <Navbar />
        <NotificationBanner />
        <main
          className={css({
            flex: 1,
            w: '100%',
            maxW: '1280px',
            mx: 'auto',
            p: { base: '80px 16px 24px', md: '88px 24px 32px' },
          })}
        >
          {children}
        </main>
      </body>
    </html>
  )
}
