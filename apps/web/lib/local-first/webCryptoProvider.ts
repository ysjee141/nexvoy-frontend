import type {
  BackupCryptoProvider,
  DocumentEncryptionKey,
  RsaOaepKeyHandle,
  RsaOaepPrivateKeyMaterial,
  RsaOaepPublicKeyMaterial,
  RsaOaepWrappingProvider,
} from '@nexvoy/core/sync/encryption'

const AES_GCM_ALGORITHM = 'AES-GCM'
const AES_KEY_LENGTH = 256
const RSA_OAEP_ALGORITHM = 'RSA-OAEP'
const RSA_HASH = 'SHA-256'
const RSA_MODULUS_LENGTH = 2048
const RSA_PUBLIC_EXPONENT = new Uint8Array([1, 0, 1])

export interface WebRsaOaepKeyMaterial {
  publicKeyJwk: RsaOaepPublicKeyMaterial
  privateKeyJwk: RsaOaepPrivateKeyMaterial
}

export function getWebBackupCryptoProvider(): BackupCryptoProvider {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto is unavailable.')
  }
  return crypto
}

export function createWebRsaOaepWrappingProvider(): RsaOaepWrappingProvider {
  const provider = getWebBackupCryptoProvider()

  return {
    importPublicKey: async (publicKeyJwk: RsaOaepPublicKeyMaterial) => {
      return provider.subtle.importKey(
        'jwk',
        publicKeyJwk as JsonWebKey,
        { name: RSA_OAEP_ALGORITHM, hash: RSA_HASH },
        false,
        ['wrapKey'],
      )
    },
    importPrivateKey: async (privateKeyJwk: RsaOaepPrivateKeyMaterial) => {
      return provider.subtle.importKey(
        'jwk',
        privateKeyJwk as JsonWebKey,
        { name: RSA_OAEP_ALGORITHM, hash: RSA_HASH },
        false,
        ['unwrapKey'],
      )
    },
    wrapDocumentKey: async (input: { documentKey: DocumentEncryptionKey; publicKey: RsaOaepKeyHandle }) => {
      const wrapped = await provider.subtle.wrapKey(
        'raw',
        input.documentKey,
        input.publicKey as CryptoKey,
        { name: RSA_OAEP_ALGORITHM },
      )
      return new Uint8Array(wrapped)
    },
    unwrapDocumentKey: async (input: { wrappedDek: Uint8Array; privateKey: RsaOaepKeyHandle }) => {
      return provider.subtle.unwrapKey(
        'raw',
        toArrayBuffer(input.wrappedDek),
        input.privateKey as CryptoKey,
        { name: RSA_OAEP_ALGORITHM },
        { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
        true,
        ['decrypt', 'encrypt'],
      )
    },
  }
}

export async function generateWebRsaOaepKeyMaterial(): Promise<WebRsaOaepKeyMaterial> {
  const provider = getWebBackupCryptoProvider()
  const keyPair = await provider.subtle.generateKey(
    {
      name: RSA_OAEP_ALGORITHM,
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: RSA_PUBLIC_EXPONENT,
      hash: RSA_HASH,
    },
    true,
    ['wrapKey', 'unwrapKey'],
  ) as CryptoKeyPair

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    provider.subtle.exportKey('jwk', keyPair.publicKey),
    provider.subtle.exportKey('jwk', keyPair.privateKey),
  ])

  return {
    publicKeyJwk: publicKeyJwk as RsaOaepPublicKeyMaterial,
    privateKeyJwk: privateKeyJwk as RsaOaepPrivateKeyMaterial,
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
