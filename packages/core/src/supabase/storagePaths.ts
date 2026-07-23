import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'

// Storage 경로 규칙 — domain.md 기준
// object path는 bucket 내부 경로다: [user_id]/[trip_id]/[filename]
// place photo는 place 식별 hash + width suffix로 immutable content path를 만든다.
// place 가 바뀌면 hash 가 바뀌어 새 object 가 생기고, 이전 object 는 orphan cleanup 대상이 된다.

export const PLACE_PHOTO_BUCKET = 'place-photos'
export const PLACE_PHOTO_ORIGINAL_WIDTH = 800
export const PLACE_PHOTO_THUMB_WIDTH = 240

export type PlacePhotoWidth =
  | typeof PLACE_PHOTO_ORIGINAL_WIDTH
  | typeof PLACE_PHOTO_THUMB_WIDTH

export function placeIdHash8(placeId: string): string {
  return bytesToHex(sha256(utf8ToBytes(placeId))).slice(0, 8)
}

export function placePhotoObjectPath(
  userId: string,
  tripId: string,
  planId: string,
  placeIdHash8: string,
  width: PlacePhotoWidth,
): string {
  return `${userId}/${tripId}/${planId}_${placeIdHash8}_w${width}.jpg`
}

// image_url(원본 _w800) 에서 thumbnail(_w240) URL 을 파생한다.
// width suffix 가 없는 legacy URL 이나 place-photos 외 URL 은 null — 호출측은 원본을 그대로 쓴다.
export function derivePlacePhotoThumbUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (!imageUrl.includes(`/${PLACE_PHOTO_BUCKET}/`)) return null
  const match = imageUrl.match(/^(.+_w)800(\.jpg)(\?.*)?$/)
  if (!match) return null
  return `${match[1]}${PLACE_PHOTO_THUMB_WIDTH}${match[2]}${match[3] ?? ''}`
}

// 예약 경로 (업로드 UI 미구현 — TASK-054 기준 정책만 고정)
export function tripCoverPath(userId: string, tripId: string): string {
  return `trip-covers/${userId}/${tripId}/cover.jpg`
}

export function avatarPath(userId: string): string {
  return `avatars/${userId}/avatar.jpg`
}
