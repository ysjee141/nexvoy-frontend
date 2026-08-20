import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '갈래',
    short_name: '갈래',
    description: '계획부터 기록까지, 함께 만드는 여행 서비스',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0D2340',
    icons: [
      {
        src: '/icons/gallae-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/gallae-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/gallae-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
