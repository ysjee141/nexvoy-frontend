import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/exchange?from=JPY
 * Frankfurter API를 통해 {from} → KRW 환율 조회
 * 결과는 Next.js 서버 캐시로 1시간 유지
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')?.toUpperCase()

    if (!from) {
        return NextResponse.json({ error: 'from parameter required' }, { status: 400 })
    }

    // KRW끼리는 환율 계산 불필요
    if (from === 'KRW') {
        return NextResponse.json({ from: 'KRW', to: 'KRW', rate: 1 })
    }

    try {
        // Frankfurter API: 1 {from} = ? KRW
        const res = await fetch(
            `https://api.frankfurter.app/latest?from=${from}&to=KRW`,
            { next: { revalidate: 3600 } } // 1시간 캐싱
        )

        if (!res.ok) {
            throw new Error(`Frankfurter API error: ${res.status}`)
        }

        const data = await res.json()
        const rate = data.rates?.KRW

        if (!rate) {
            // Frankfurter에서 지원하지 않는 통화 (VND, IDR 등)
            // 대략적인 환율을 fallback으로 제공
            const fallbackRates: Record<string, number> = {
                VND: 0.054,    // 1 VND ≈ 0.054 KRW
                IDR: 0.086,    // 1 IDR ≈ 0.086 KRW
                PHP: 24.2,     // 1 PHP ≈ 24.2 KRW
                TRY: 39.5,     // 1 TRY ≈ 39.5 KRW
                EGP: 27.2,     // 1 EGP ≈ 27.2 KRW
                NPR: 9.8,      // 1 NPR ≈ 9.8 KRW
                BDT: 12.1,     // 1 BDT ≈ 12.1 KRW
                SAR: 355.8,    // 1 SAR ≈ 355.8 KRW
                AED: 364.7,    // 1 AED ≈ 364.7 KRW
            }
            const fallback = fallbackRates[from]
            if (fallback) {
                return NextResponse.json({ from, to: 'KRW', rate: fallback, isFallback: true })
            }
            return NextResponse.json({ error: 'Unsupported currency' }, { status: 404 })
        }

        return NextResponse.json({ from, to: 'KRW', rate })
    } catch (error) {
        console.error('Exchange rate fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 500 })
    }
}
