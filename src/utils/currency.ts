/**
 * 타임존 문자열 → 통화 정보 매핑 유틸
 */

export interface CurrencyInfo {
    code: string      // ISO 4217 (JPY, USD, EUR, ...)
    symbol: string    // 표시 심볼 (¥, $, €, ...)
    locale: string    // Intl.NumberFormat용 locale
    name: string      // 한국어 풀네임
}

const TIMEZONE_CURRENCY_MAP: Record<string, CurrencyInfo> = {
    // 아시아
    'Asia/Tokyo': { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: '일본 엔' },
    'Asia/Osaka': { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: '일본 엔' },
    'Asia/Seoul': { code: 'KRW', symbol: '₩', locale: 'ko-KR', name: '한국 원' },
    'Asia/Shanghai': { code: 'CNY', symbol: '¥', locale: 'zh-CN', name: '중국 위안' },
    'Asia/Hong_Kong': { code: 'HKD', symbol: 'HK$', locale: 'zh-HK', name: '홍콩 달러' },
    'Asia/Taipei': { code: 'TWD', symbol: 'NT$', locale: 'zh-TW', name: '대만 달러' },
    'Asia/Singapore': { code: 'SGD', symbol: 'S$', locale: 'en-SG', name: '싱가포르 달러' },
    'Asia/Bangkok': { code: 'THB', symbol: '฿', locale: 'th-TH', name: '태국 바트' },
    'Asia/Ho_Chi_Minh': { code: 'VND', symbol: '₫', locale: 'vi-VN', name: '베트남 동' },
    'Asia/Jakarta': { code: 'IDR', symbol: 'Rp', locale: 'id-ID', name: '인도네시아 루피아' },
    'Asia/Kuala_Lumpur': { code: 'MYR', symbol: 'RM', locale: 'ms-MY', name: '말레이시아 링깃' },
    'Asia/Manila': { code: 'PHP', symbol: '₱', locale: 'en-PH', name: '필리핀 페소' },
    'Asia/Kolkata': { code: 'INR', symbol: '₹', locale: 'en-IN', name: '인도 루피' },
    'Asia/Dubai': { code: 'AED', symbol: 'AED', locale: 'ar-AE', name: '아랍에미리트 디르함' },
    'Asia/Riyadh': { code: 'SAR', symbol: 'SR', locale: 'ar-SA', name: '사우디 리얄' },
    'Asia/Istanbul': { code: 'TRY', symbol: '₺', locale: 'tr-TR', name: '터키 리라' },
    'Asia/Kathmandu': { code: 'NPR', symbol: 'Rs', locale: 'ne-NP', name: '네팔 루피' },
    'Asia/Dhaka': { code: 'BDT', symbol: '৳', locale: 'bn-BD', name: '방글라데시 타카' },

    // 유럽
    'Europe/Paris': { code: 'EUR', symbol: '€', locale: 'fr-FR', name: '유로' },
    'Europe/Berlin': { code: 'EUR', symbol: '€', locale: 'de-DE', name: '유로' },
    'Europe/Rome': { code: 'EUR', symbol: '€', locale: 'it-IT', name: '유로' },
    'Europe/Madrid': { code: 'EUR', symbol: '€', locale: 'es-ES', name: '유로' },
    'Europe/Amsterdam': { code: 'EUR', symbol: '€', locale: 'nl-NL', name: '유로' },
    'Europe/Vienna': { code: 'EUR', symbol: '€', locale: 'de-AT', name: '유로' },
    'Europe/Brussels': { code: 'EUR', symbol: '€', locale: 'fr-BE', name: '유로' },
    'Europe/Lisbon': { code: 'EUR', symbol: '€', locale: 'pt-PT', name: '유로' },
    'Europe/Athens': { code: 'EUR', symbol: '€', locale: 'el-GR', name: '유로' },
    'Europe/Helsinki': { code: 'EUR', symbol: '€', locale: 'fi-FI', name: '유로' },
    'Europe/London': { code: 'GBP', symbol: '£', locale: 'en-GB', name: '영국 파운드' },
    'Europe/Zurich': { code: 'CHF', symbol: 'CHF', locale: 'de-CH', name: '스위스 프랑' },
    'Europe/Stockholm': { code: 'SEK', symbol: 'kr', locale: 'sv-SE', name: '스웨덴 크로나' },
    'Europe/Oslo': { code: 'NOK', symbol: 'kr', locale: 'nb-NO', name: '노르웨이 크로네' },
    'Europe/Copenhagen': { code: 'DKK', symbol: 'kr', locale: 'da-DK', name: '덴마크 크로네' },
    'Europe/Warsaw': { code: 'PLN', symbol: 'zł', locale: 'pl-PL', name: '폴란드 즐로티' },
    'Europe/Prague': { code: 'CZK', symbol: 'Kč', locale: 'cs-CZ', name: '체코 코루나' },
    'Europe/Budapest': { code: 'HUF', symbol: 'Ft', locale: 'hu-HU', name: '헝가리 포린트' },
    'Europe/Bucharest': { code: 'RON', symbol: 'lei', locale: 'ro-RO', name: '루마니아 레우' },
    'Europe/Moscow': { code: 'RUB', symbol: '₽', locale: 'ru-RU', name: '러시아 루블' },

    // 아메리카
    'America/New_York': { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' },
    'America/Los_Angeles': { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' },
    'America/Chicago': { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' },
    'America/Denver': { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' },
    'America/Phoenix': { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' },
    'America/Toronto': { code: 'CAD', symbol: 'CA$', locale: 'en-CA', name: '캐나다 달러' },
    'America/Vancouver': { code: 'CAD', symbol: 'CA$', locale: 'en-CA', name: '캐나다 달러' },
    'America/Sao_Paulo': { code: 'BRL', symbol: 'R$', locale: 'pt-BR', name: '브라질 헤알' },
    'America/Mexico_City': { code: 'MXN', symbol: 'MX$', locale: 'es-MX', name: '멕시코 페소' },
    'America/Argentina/Buenos_Aires': { code: 'ARS', symbol: '$', locale: 'es-AR', name: '아르헨티나 페소' },

    // 오세아니아
    'Australia/Sydney': { code: 'AUD', symbol: 'A$', locale: 'en-AU', name: '호주 달러' },
    'Australia/Melbourne': { code: 'AUD', symbol: 'A$', locale: 'en-AU', name: '호주 달러' },
    'Pacific/Auckland': { code: 'NZD', symbol: 'NZ$', locale: 'en-NZ', name: '뉴질랜드 달러' },

    // 아프리카
    'Africa/Cairo': { code: 'EGP', symbol: 'E£', locale: 'ar-EG', name: '이집트 파운드' },
    'Africa/Johannesburg': { code: 'ZAR', symbol: 'R', locale: 'en-ZA', name: '남아공 랜드' },
}

/** 기본 통화 (타임존 매칭 실패 시) */
const DEFAULT_CURRENCY: CurrencyInfo = {
    code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러'
}

/**
 * 타임존 문자열에서 통화 정보를 반환합니다.
 * 정확히 일치하지 않으면 지역(continent/region) 접두사로 부분 매핑 시도.
 */
export function getCurrencyFromTimezone(timezone: string): CurrencyInfo {
    if (!timezone) return DEFAULT_CURRENCY

    // 정확히 일치하는 경우
    if (TIMEZONE_CURRENCY_MAP[timezone]) {
        return TIMEZONE_CURRENCY_MAP[timezone]
    }

    // 지역 접두사로 유추 (예: Europe/__ → EUR)
    const prefix = timezone.split('/')[0]
    if (prefix === 'Europe') return { code: 'EUR', symbol: '€', locale: 'fr-FR', name: '유로' }
    if (prefix === 'America') return { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' }
    if (prefix === 'Australia') return { code: 'AUD', symbol: 'A$', locale: 'en-AU', name: '호주 달러' }
    if (prefix === 'Pacific') return { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' }
    if (prefix === 'Africa') return { code: 'USD', symbol: '$', locale: 'en-US', name: '미국 달러' }

    return DEFAULT_CURRENCY
}

/**
 * 금액을 현지 통화 형식으로 포맷
 */
export function formatCurrency(amount: number, currency: CurrencyInfo): string {
    try {
        return new Intl.NumberFormat(currency.locale, {
            style: 'currency',
            currency: currency.code,
            maximumFractionDigits: currency.code === 'JPY' || currency.code === 'KRW' || currency.code === 'VND' ? 0 : 2,
        }).format(amount)
    } catch {
        return `${currency.symbol}${amount.toLocaleString()}`
    }
}

/**
 * 원화(KRW) 형식으로 포맷
 */
export function formatKRW(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
    }).format(amount)
}
