import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)',
  ],
}
