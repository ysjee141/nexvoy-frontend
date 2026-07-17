import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

interface CleanupRequestBody {
    dryRun?: boolean
    retentionDays?: number
}

interface OrphanAssetRow {
    asset_id: string
    bucket_id: string
    object_path: string
}

const DEFAULT_RETENTION_DAYS = 7
const MAX_REMOVE_BATCH = 100

/**
 * Orphan place photo cleanup — 외부 스케줄러(cron) 전용.
 * plans에서 더 이상 참조되지 않는 object를 retention 이후 Storage에서 삭제한다.
 * SQL이 storage.objects를 직접 지우지 않고 Storage API로만 삭제한다 (TASK-054).
 */
export async function POST(request: NextRequest) {
    const secret = process.env.ASSET_CLEANUP_SECRET
    if (!secret) {
        return NextResponse.json({ error: 'Cleanup disabled' }, { status: 503 })
    }
    if (request.headers.get('x-cron-secret') !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: CleanupRequestBody = {}
    try {
        const raw = await request.text()
        if (raw) body = JSON.parse(raw) as CleanupRequestBody
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const dryRun = body.dryRun === true
    const retentionDays =
        typeof body.retentionDays === 'number' && body.retentionDays >= 1
            ? Math.floor(body.retentionDays)
            : DEFAULT_RETENTION_DAYS

    const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const listed = await admin.rpc('list_orphan_place_photo_assets', {
        p_retention: `${retentionDays} days`,
    })
    if (listed.error) {
        console.error('[assets/cleanup] orphan listing failed:', listed.error.message)
        return NextResponse.json({ error: 'Orphan listing failed' }, { status: 500 })
    }

    const orphans = (listed.data ?? []) as OrphanAssetRow[]
    if (dryRun || orphans.length === 0) {
        return NextResponse.json({
            data: { dryRun, retentionDays, orphanCount: orphans.length, removedCount: 0 },
        })
    }

    const byBucket = new Map<string, OrphanAssetRow[]>()
    for (const orphan of orphans) {
        const rows = byBucket.get(orphan.bucket_id) ?? []
        rows.push(orphan)
        byBucket.set(orphan.bucket_id, rows)
    }

    const removedAssetIds: string[] = []
    for (const [bucketId, rows] of byBucket) {
        for (let index = 0; index < rows.length; index += MAX_REMOVE_BATCH) {
            const batch = rows.slice(index, index + MAX_REMOVE_BATCH)
            const removal = await admin.storage
                .from(bucketId)
                .remove(batch.map((row) => row.object_path))
            if (removal.error) {
                console.error(
                    `[assets/cleanup] storage remove failed (bucket=${bucketId}):`,
                    removal.error.message,
                )
                continue
            }
            removedAssetIds.push(...batch.map((row) => row.asset_id))
        }
    }

    if (removedAssetIds.length > 0) {
        const metadataDelete = await admin
            .from('trip_asset_objects')
            .delete()
            .in('id', removedAssetIds)
        if (metadataDelete.error) {
            console.error(
                '[assets/cleanup] metadata delete failed:',
                metadataDelete.error.message,
            )
        }
    }

    return NextResponse.json({
        data: {
            dryRun,
            retentionDays,
            orphanCount: orphans.length,
            removedCount: removedAssetIds.length,
        },
    })
}
