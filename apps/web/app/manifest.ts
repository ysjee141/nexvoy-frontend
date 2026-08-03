import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '온여정',
    short_name: '온여정',
    description: '일정과 준비물을 함께 관리하는 여행 서비스',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#2563EB',
    icons: [
      {
        src: '/icons/onvoy-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/onvoy-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/onvoy-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
