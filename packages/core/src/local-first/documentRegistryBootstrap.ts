export function shouldBootstrapDocumentRegistry(input: {
  authUserId: string | null
  tripOwnerId: string
}): boolean {
  if (input.authUserId === null) return false
  return input.authUserId === input.tripOwnerId
}
