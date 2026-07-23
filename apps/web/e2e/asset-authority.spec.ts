import { randomUUID } from 'node:crypto'
import {
  PLACE_PHOTO_BUCKET,
  PLACE_PHOTO_ORIGINAL_WIDTH,
  placeIdHash8,
  placePhotoObjectPath,
} from '@nexvoy/core'
import { test, expect } from './fixtures/auth'
import {
  cleanupPlacePhotoAssets,
  cleanupTripsByUser,
  createAuthenticatedTestClient,
  revokeAuthorityDocumentMember,
  seedAuthorityDocumentMember,
  seedAuthorityPlan,
  seedAuthorityTrip,
} from './helpers/seed'
import type { TestUser } from './helpers/supabase'

const TEST_IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])

test.describe('TASK-058 place photo authority', () => {
  test('NEW-A08 canonical path writes and metadata follow trip authority', async ({
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 자산 권한',
    })
    const plan = await seedAuthorityPlan(multiUsers.owner, trip, '자산 검증 일정')
    await seedAuthorityDocumentMember(trip.id, multiUsers.viewer, 'viewer')
    const editorMember = await seedAuthorityDocumentMember(
      trip.id,
      multiUsers.editor,
      'editor',
    )

    const ownerPath = pathFor(multiUsers.owner, trip.id, plan.id, 'owner-place', 800)
    const editorPath = pathFor(multiUsers.editor, trip.id, plan.id, 'editor-place', 800)
    const editorDeletePath = pathFor(
      multiUsers.editor,
      trip.id,
      plan.id,
      'editor-delete-place',
      240,
    )
    const viewerPath = pathFor(multiUsers.viewer, trip.id, plan.id, 'viewer-place', 800)
    const outsiderPath = pathFor(multiUsers.outsider, trip.id, plan.id, 'outsider-place', 800)
    const allPaths = [
      ownerPath,
      editorPath,
      editorDeletePath,
      viewerPath,
      outsiderPath,
    ]

    try {
      const ownerClient = createAuthenticatedTestClient(multiUsers.owner)
      const editorClient = createAuthenticatedTestClient(multiUsers.editor)
      const viewerClient = createAuthenticatedTestClient(multiUsers.viewer)
      const outsiderClient = createAuthenticatedTestClient(multiUsers.outsider)

      expect(await upload(ownerClient, ownerPath)).toBeNull()
      expect(await upload(editorClient, editorPath)).toBeNull()
      expect(await upload(editorClient, editorDeletePath)).toBeNull()
      expect(await upload(viewerClient, viewerPath)).toMatch(/row-level security|not authorized/i)
      expect(await upload(outsiderClient, outsiderPath)).toMatch(/row-level security|not authorized/i)

      const malformedPath = placePhotoObjectPath(
        multiUsers.editor.id,
        randomUUID(),
        plan.id,
        placeIdHash8('wrong-trip'),
        PLACE_PHOTO_ORIGINAL_WIDTH,
      )
      expect(await upload(editorClient, malformedPath)).toMatch(/row-level security|not authorized/i)

      expect(await register(ownerClient, trip.id, plan.id, ownerPath, 800)).toBeNull()
      expect(await register(editorClient, trip.id, plan.id, editorPath, 800)).toBeNull()
      expect(await register(ownerClient, trip.id, plan.id, ownerPath, 240)).toMatch(
        /asset_path_forbidden/,
      )
      expect(await register(editorClient, trip.id, plan.id, ownerPath, 800)).toMatch(
        /asset_path_forbidden/,
      )

      const { data: viewerRows, error: viewerReadError } = await viewerClient
        .from('trip_asset_objects')
        .select('object_path')
        .eq('trip_id', trip.id)
      expect(viewerReadError).toBeNull()
      expect(viewerRows?.map((row) => row.object_path).sort()).toEqual(
        [editorPath, ownerPath].sort(),
      )

      const { data: outsiderRows, error: outsiderReadError } = await outsiderClient
        .from('trip_asset_objects')
        .select('object_path')
        .eq('trip_id', trip.id)
      expect(outsiderReadError).toBeNull()
      expect(outsiderRows).toEqual([])

      const ownerPublicUrl = publicUrl(ownerClient, ownerPath)
      const editorPublicUrl = publicUrl(editorClient, editorPath)
      const editorDeletePublicUrl = publicUrl(editorClient, editorDeletePath)

      expect(await remove(viewerClient, ownerPath)).toBeNull()
      expect((await fetch(ownerPublicUrl)).status).toBe(200)
      expect(await remove(editorClient, editorDeletePath)).toBeNull()
      expect((await fetch(editorDeletePublicUrl)).status).not.toBe(200)

      const anonymousDownload = await fetch(ownerPublicUrl)
      expect(anonymousDownload.status).toBe(200)
      expect(new Uint8Array(await anonymousDownload.arrayBuffer())).toEqual(TEST_IMAGE)

      await revokeAuthorityDocumentMember(multiUsers.owner, editorMember.id)

      const { data: revokedRows, error: revokedReadError } = await editorClient
        .from('trip_asset_objects')
        .select('object_path')
        .eq('trip_id', trip.id)
      expect(revokedReadError).toBeNull()
      expect(revokedRows).toEqual([])
      expect(await remove(editorClient, editorPath)).toBeNull()
      expect((await fetch(editorPublicUrl)).status).toBe(200)
      expect((await fetch(ownerPublicUrl)).status).toBe(200)

      expect(await remove(ownerClient, ownerPath)).toBeNull()
      expect((await fetch(ownerPublicUrl)).status).not.toBe(200)
    } finally {
      await cleanupPlacePhotoAssets(allPaths)
      await cleanupTripsByUser(multiUsers.owner.id)
    }
  })
})

function pathFor(
  user: TestUser,
  tripId: string,
  planId: string,
  placeId: string,
  width: 240 | 800,
): string {
  return placePhotoObjectPath(user.id, tripId, planId, placeIdHash8(placeId), width)
}

async function upload(
  client: ReturnType<typeof createAuthenticatedTestClient>,
  objectPath: string,
): Promise<string | null> {
  const { error } = await client.storage
    .from(PLACE_PHOTO_BUCKET)
    .upload(objectPath, TEST_IMAGE, { contentType: 'image/jpeg', upsert: true })
  return error?.message ?? null
}

async function remove(
  client: ReturnType<typeof createAuthenticatedTestClient>,
  objectPath: string,
): Promise<string | null> {
  const { error } = await client.storage.from(PLACE_PHOTO_BUCKET).remove([objectPath])
  return error?.message ?? null
}

function publicUrl(
  client: ReturnType<typeof createAuthenticatedTestClient>,
  objectPath: string,
): string {
  return client.storage.from(PLACE_PHOTO_BUCKET).getPublicUrl(objectPath).data.publicUrl
}

async function register(
  client: ReturnType<typeof createAuthenticatedTestClient>,
  tripId: string,
  planId: string,
  objectPath: string,
  width: 240 | 800,
): Promise<string | null> {
  const { error } = await client.rpc('register_place_photo_asset', {
    p_trip_id: tripId,
    p_plan_id: planId,
    p_object_path: objectPath,
    p_width: width,
  })
  return error?.message ?? null
}
