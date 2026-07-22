'use client'

import { useEffect } from 'react'
import { resetLegacyWebV1Storage } from '@/lib/data/legacyV1Reset'

export default function LegacyV1Reset() {
  useEffect(() => {
    void resetLegacyWebV1Storage().catch((error) => {
      console.warn('[legacy V1 reset deferred]', error)
    })
  }, [])

  return null
}
