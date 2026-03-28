import { NextRequest, NextResponse } from 'next/server'

// URL의 Open Graph 메타데이터를 가져와 캐싱
const cache = new Map<string, { data: OGData; ts: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1시간

interface OGData {
    title?: string
    description?: string
    image?: string
    favicon?: string
    hostname: string
    url: string
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    // 캐시 확인
    const cached = cache.get(url)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json(cached.data)
    }

    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
            signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) throw new Error('fetch failed')

        const html = await res.text()

        // OG 태그 파싱
        const getOG = (prop: string) =>
            html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
            html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1]

        const title =
            getOG('title') ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()

        const description =
            getOG('description') ||
            html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]

        const image = getOG('image')

        // favicon
        const faviconPath =
            html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
            '/favicon.ico'
        const favicon = faviconPath.startsWith('http')
            ? faviconPath
            : `${parsed.protocol}//${hostname}${faviconPath.startsWith('/') ? '' : '/'}${faviconPath}`

        const data: OGData = {
            title: title?.substring(0, 120),
            description: description?.substring(0, 200),
            image,
            favicon,
            hostname,
            url,
        }

        cache.set(url, { data, ts: Date.now() })
        return NextResponse.json(data)
    } catch {
        // 최소 fallback
        try {
            const parsed = new URL(url)
            const data: OGData = { hostname: parsed.hostname, url }
            return NextResponse.json(data)
        } catch {
            return NextResponse.json({ error: 'invalid url' }, { status: 400 })
        }
    }
}
