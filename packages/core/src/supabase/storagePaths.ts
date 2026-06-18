// Storage 경로 규칙 — domain.md 기준
// 모든 경로는 [bucket]/[user_id]/[trip_id]/[filename] 패턴을 따른다.

export function planPhotoPath(
  userId: string,
  tripId: string,
  planId: string,
  hash: string
): string {
  return `place-photos/${userId}/${tripId}/${planId}_${hash}.jpg`
}

export function tripCoverPath(userId: string, tripId: string): string {
  return `trip-covers/${userId}/${tripId}/cover.jpg`
}

export function avatarPath(userId: string): string {
  return `avatars/${userId}/avatar.jpg`
}
