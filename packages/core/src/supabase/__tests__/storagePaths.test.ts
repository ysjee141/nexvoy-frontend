import assert from 'node:assert/strict'
import {
  PLACE_PHOTO_ORIGINAL_WIDTH,
  PLACE_PHOTO_THUMB_WIDTH,
  derivePlacePhotoThumbUrl,
  placePhotoObjectPath,
} from '../storagePaths'

const userId = '00000000-0000-0000-0000-000000000001'
const tripId = '00000000-0000-0000-0000-000000000002'
const planId = '00000000-0000-0000-0000-000000000003'

assert.equal(
  placePhotoObjectPath(userId, tripId, planId, 'abcd1234', PLACE_PHOTO_ORIGINAL_WIDTH),
  `${userId}/${tripId}/${planId}_abcd1234_w800.jpg`,
)
assert.equal(
  placePhotoObjectPath(userId, tripId, planId, 'abcd1234', PLACE_PHOTO_THUMB_WIDTH),
  `${userId}/${tripId}/${planId}_abcd1234_w240.jpg`,
)

const publicUrl =
  `https://example.supabase.co/storage/v1/object/public/place-photos/${userId}/${tripId}/${planId}_abcd1234_w800.jpg`
assert.equal(
  derivePlacePhotoThumbUrl(publicUrl),
  `https://example.supabase.co/storage/v1/object/public/place-photos/${userId}/${tripId}/${planId}_abcd1234_w240.jpg`,
)

// query string 유지
assert.equal(
  derivePlacePhotoThumbUrl(`${publicUrl}?v=1`),
  `https://example.supabase.co/storage/v1/object/public/place-photos/${userId}/${tripId}/${planId}_abcd1234_w240.jpg?v=1`,
)

// legacy URL (width suffix 없음) → null
assert.equal(
  derivePlacePhotoThumbUrl(
    `https://example.supabase.co/storage/v1/object/public/place-photos/${userId}/${tripId}/${planId}_abcd1234.jpg`,
  ),
  null,
)

// place-photos 외 URL → null
assert.equal(
  derivePlacePhotoThumbUrl('https://lh3.googleusercontent.com/foo_w800.jpg'),
  null,
)

// null/undefined → null
assert.equal(derivePlacePhotoThumbUrl(null), null)
assert.equal(derivePlacePhotoThumbUrl(undefined), null)

console.log('storagePaths tests passed')
