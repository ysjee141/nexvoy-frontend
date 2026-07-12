import { shouldBootstrapDocumentRegistry } from '../documentRegistryBootstrap'

if (!shouldBootstrapDocumentRegistry({ authUserId: 'user-1', tripOwnerId: 'user-1' })) {
  throw new Error('Owner accessing their own trip should bootstrap.')
}

if (shouldBootstrapDocumentRegistry({ authUserId: 'user-2', tripOwnerId: 'user-1' })) {
  throw new Error('Non-owner accessing another owner\'s trip should not bootstrap.')
}

if (shouldBootstrapDocumentRegistry({ authUserId: null, tripOwnerId: 'guest:device-1' })) {
  throw new Error('Guest (unauthenticated) access should not bootstrap.')
}
