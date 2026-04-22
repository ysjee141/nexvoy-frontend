#!/usr/bin/env node
/**
 * plans.image_url 세션 종속 Google Photo URL → 영구 URL 마이그레이션
 *
 * 배경:
 *   초기 버전에서 place.photos[0].getUrl()이 반환한 세션 종속 URL이
 *   plans.image_url에 저장되어 있음. 이 URL은 PhotoService.GetPhoto 내부
 *   엔드포인트로 리다이렉트되어 세션 없는 환경(img, background-image)에서
 *   403을 반환하므로 영구 CDN URL로 교체 필요.
 *
 * 동작:
 *   1. plans에서 image_url이 세션 URL 패턴을 포함하는 row 조회
 *   2. 각 row의 google_place_id로 Places Details REST API → photo_reference 획득
 *   3. Photo API에 redirect: 'manual'로 요청해 Location 헤더의 영구 CDN URL 획득
 *   4. plans.image_url 업데이트
 *
 * 필수 env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (RLS 우회 목적)
 *   GOOGLE_MAPS_API_KEY         (서버용. NEXT_PUBLIC_* 도 허용)
 *
 * 옵션:
 *   --dry-run        실제 UPDATE 없이 계획만 출력
 *   --batch-size=N   1회 조회 페이지 크기 (기본 100)
 *   --limit=N        최대 처리 row 수 (기본 무제한)
 *   --delay-ms=N     Google API 호출 간 지연 ms (기본 120)
 *
 * 사용:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_MAPS_API_KEY=... \
 *     node scripts/migrate-plan-photos.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://runbcaegpefqnljsswhv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bmJjYWVncGVmcW5sanNzd2h2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYyOTIyNCwiZXhwIjoyMDg3MjA1MjI0fQ.n9oW3Oda8rEW10A5mPvHOml8Z2XBGfdXz1TDFvNzSAE'
const GOOGLE_MAPS_API_KEY =
    'AIzaSyDoCLmyfUoYURh61HumCMqbMHq6-22Gor8'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const getFlag = (name, def) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.split('=')[1] : def
}
const BATCH_SIZE = Number(getFlag('batch-size', 100))
const LIMIT = Number(getFlag('limit', 0)) // 0 = 무제한
const DELAY_MS = Number(getFlag('delay-ms', 120))

// --- 필수 env 검증 ---
const missing = []
if (!SUPABASE_URL) missing.push('SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (!GOOGLE_MAPS_API_KEY) missing.push('GOOGLE_MAPS_API_KEY')
if (missing.length) {
    console.error(`ERROR: 필수 환경변수 누락: ${missing.join(', ')}`)
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
})

// 세션 종속 URL 식별 패턴 (Postgres ILIKE용 / JS용)
const SQL_PATTERN = '%PhotoService.GetPhoto%'
const SQL_PATTERN_ALT = '%/maps/api/place/js/%'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * place_id → 영구 CDN URL 해석
 * @returns {Promise<{url: string|null, reason?: string}>}
 */
async function resolvePermanentPhotoUrl(placeId, maxwidth = 400) {
    try {
        // 1. photo_reference 조회
        const detailsUrl =
            `https://maps.googleapis.com/maps/api/place/details/json` +
            `?place_id=${encodeURIComponent(placeId)}` +
            `&fields=photos` +
            `&key=${GOOGLE_MAPS_API_KEY}`
        const detailsRes = await fetch(detailsUrl)
        if (!detailsRes.ok) {
            return { url: null, reason: `details_http_${detailsRes.status}` }
        }
        const detailsData = await detailsRes.json()

        if (detailsData.status !== 'OK') {
            return { url: null, reason: `details_status_${detailsData.status}` }
        }
        const photoRef = detailsData.result?.photos?.[0]?.photo_reference
        if (!photoRef) {
            return { url: null, reason: 'no_photo_reference' }
        }

        // 2. Photo API 리다이렉트 Location 헤더 = 영구 CDN URL
        const photoApiUrl =
            `https://maps.googleapis.com/maps/api/place/photo` +
            `?maxwidth=${maxwidth}` +
            `&photo_reference=${photoRef}` +
            `&key=${GOOGLE_MAPS_API_KEY}`
        const photoRes = await fetch(photoApiUrl, { redirect: 'manual' })
        const location = photoRes.headers.get('location')
        if (!location) {
            // 3xx가 아닌 응답이면 영구 URL 획득 실패
            return { url: null, reason: `photo_http_${photoRes.status}` }
        }
        return { url: location }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { url: null, reason: `exception:${msg}` }
    }
}

/**
 * 마이그레이션 대상 조회 (페이지네이션)
 */
async function fetchTargets(from, to) {
    const { data, error } = await supabase
        .from('plans')
        .select('id, trip_id, google_place_id, image_url')
        .or(
            `image_url.ilike.${SQL_PATTERN},image_url.ilike.${SQL_PATTERN_ALT}`,
        )
        .order('created_at', { ascending: true })
        .range(from, to)

    if (error) {
        throw new Error(`Supabase select 실패: ${error.message}`)
    }
    return data || []
}

async function main() {
    console.log('=== Plan Photo URL 마이그레이션 시작 ===')
    console.log(`모드          : ${isDryRun ? 'DRY RUN (변경 없음)' : 'EXECUTE'}`)
    console.log(`배치 크기     : ${BATCH_SIZE}`)
    console.log(`최대 처리     : ${LIMIT || '무제한'}`)
    console.log(`API 호출 지연 : ${DELAY_MS}ms`)
    console.log('')

    const stats = {
        scanned: 0,
        updated: 0,
        skippedNoPlaceId: 0,
        failedResolve: 0,
        failedUpdate: 0,
        reasons: {},
    }
    const failures = []

    let offset = 0
    while (true) {
        const to = offset + BATCH_SIZE - 1
        const rows = await fetchTargets(offset, to)
        if (rows.length === 0) break

        for (const row of rows) {
            if (LIMIT && stats.scanned >= LIMIT) break
            stats.scanned += 1

            if (!row.google_place_id) {
                stats.skippedNoPlaceId += 1
                failures.push({
                    id: row.id,
                    reason: 'no_google_place_id',
                })
                continue
            }

            const { url, reason } = await resolvePermanentPhotoUrl(row.google_place_id)
            await sleep(DELAY_MS)

            if (!url) {
                stats.failedResolve += 1
                stats.reasons[reason] = (stats.reasons[reason] || 0) + 1
                failures.push({ id: row.id, placeId: row.google_place_id, reason })
                continue
            }

            if (isDryRun) {
                stats.updated += 1
                console.log(
                    `[DRY] ${row.id}  ${truncate(row.image_url, 60)}  =>  ${truncate(url, 80)}`,
                )
                continue
            }

            const { data: updatedRows, error: updateError } = await supabase
                .from('plans')
                .update({ image_url: url, updated_at: new Date().toISOString() })
                .eq('id', row.id)
                .select('id')

            if (updateError) {
                stats.failedUpdate += 1
                failures.push({
                    id: row.id,
                    placeId: row.google_place_id,
                    reason: `update_error:${updateError.message}`,
                })
                console.error(`[FAIL] ${row.id} update: ${updateError.message}`)
                continue
            }

            // RLS로 row가 필터링되면 에러 없이 0건으로 반환되므로 별도 감지 필요
            if (!updatedRows || updatedRows.length === 0) {
                stats.failedUpdate += 1
                stats.reasons['zero_rows_affected'] =
                    (stats.reasons['zero_rows_affected'] || 0) + 1
                failures.push({
                    id: row.id,
                    placeId: row.google_place_id,
                    reason: 'zero_rows_affected (RLS 차단 또는 row 없음 — service_role key 필요 가능성)',
                })
                console.error(`[FAIL] ${row.id} update: 0 rows affected`)
                continue
            }

            stats.updated += 1
            console.log(`[OK ] ${row.id}  =>  ${truncate(url, 80)}`)
        }

        if (LIMIT && stats.scanned >= LIMIT) break
        if (rows.length < BATCH_SIZE) break
        offset += BATCH_SIZE
    }

    console.log('\n=== 결과 요약 ===')
    console.log(`스캔       : ${stats.scanned}`)
    console.log(`업데이트   : ${stats.updated}${isDryRun ? ' (DRY RUN)' : ''}`)
    console.log(`place_id 없음: ${stats.skippedNoPlaceId}`)
    console.log(`해석 실패  : ${stats.failedResolve}`)
    console.log(`UPDATE 실패: ${stats.failedUpdate}`)
    if (Object.keys(stats.reasons).length) {
        console.log(`실패 사유 분포:`)
        for (const [k, v] of Object.entries(stats.reasons)) {
            console.log(`  - ${k}: ${v}`)
        }
    }

    if (failures.length) {
        console.log('\n=== 실패/스킵 상세 (최대 50건) ===')
        for (const f of failures.slice(0, 50)) {
            console.log(
                `  ${f.id}${f.placeId ? ` [${f.placeId}]` : ''} :: ${f.reason}`,
            )
        }
        if (failures.length > 50) {
            console.log(`  ... 외 ${failures.length - 50}건`)
        }
    }
}

function truncate(str, n) {
    if (!str) return ''
    return str.length <= n ? str : str.slice(0, n) + '...'
}

main().catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
})
