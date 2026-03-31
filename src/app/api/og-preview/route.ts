import { NextRequest, NextResponse } from 'next/server'

// URL의 Open Graph 메타데이터를 가져와 캐싱
const cache = new Map<string, { data: OGData; ts: number }>()
const CACHE_TTL = 0 // 캐시 무효화

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

    // [캐시 우회] Fast Refresh 과정에서 Map이 비워지지 않는 문제 방지


    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname

        let fetchUrl = url
        // 네이버 블로그 URL 패턴 (iframe 우회를 위해 PostView.naver 형태의 모바일/PC 뷰 URL로 변환)
        if (hostname === 'blog.naver.com') {
            const pathParts = parsed.pathname.split('/').filter(Boolean)
            if (pathParts.length >= 2) {
                const blogId = pathParts[0]
                const logNo = pathParts[1]
                fetchUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`
            } else if (pathParts.length === 1 && parsed.searchParams.has('logNo')) {
                const blogId = pathParts[0]
                const logNo = parsed.searchParams.get('logNo')
                fetchUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`
            }
        }

        const res = await fetch(fetchUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) {
            console.error('OG fetch failed:', res.status, fetchUrl)
            throw new Error('fetch failed')
        }

        const html = await res.text()
        console.log('Fetched HTML length for', fetchUrl, ':', html.length)
        
        // OG 태그 파싱
        const getOG = (prop: string) => {
            const match = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
                          html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
            return match ? match[1] : undefined;
        }

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
