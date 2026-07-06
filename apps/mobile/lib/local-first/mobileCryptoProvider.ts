import { subtle } from 'react-native-quick-crypto'
import type {
  CryptoKey as QuickCryptoKey,
  WebCryptoKeyPair,
} from 'react-native-quick-crypto'
import type {
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

export interface MobileRsaOaepKeyMaterial {
  publicKeyJwk: RsaOaepPublicKeyMaterial
  privateKeyJwk: RsaOaepPrivateKeyMaterial
}

type MobileCryptoKey = QuickCryptoKey

export function createMobileRsaOaepWrappingProvider(): RsaOaepWrappingProvider {
  return {
    importPublicKey: async (publicKeyJwk: RsaOaepPublicKeyMaterial) => {
      return subtle.importKey(
        'jwk',
        publicKeyJwk,
        { name: RSA_OAEP_ALGORITHM, hash: RSA_HASH },
        false,
        ['wrapKey'],
      ) as Promise<RsaOaepKeyHandle>
    },
    importPrivateKey: async (privateKeyJwk: RsaOaepPrivateKeyMaterial) => {
      return subtle.importKey(
        'jwk',
        privateKeyJwk,
        { name: RSA_OAEP_ALGORITHM, hash: RSA_HASH },
        false,
        ['unwrapKey'],
      ) as Promise<RsaOaepKeyHandle>
    },
    wrapDocumentKey: async (input: { documentKey: DocumentEncryptionKey; publicKey: RsaOaepKeyHandle }) => {
      const wrapped = await subtle.wrapKey(
        'raw',
        input.documentKey as MobileCryptoKey,
        input.publicKey as MobileCryptoKey,
        { name: RSA_OAEP_ALGORITHM },
      )
      return new Uint8Array(wrapped)
    },
    unwrapDocumentKey: async (input: { wrappedDek: Uint8Array; privateKey: RsaOaepKeyHandle }) => {
      return subtle.unwrapKey(
        'raw',
        toArrayBuffer(input.wrappedDek),
        input.privateKey as MobileCryptoKey,
        { name: RSA_OAEP_ALGORITHM },
        { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
        true,
        ['decrypt', 'encrypt'],
      ) as Promise<DocumentEncryptionKey>
    },
  }
}

export async function generateMobileRsaOaepKeyMaterial(): Promise<MobileRsaOaepKeyMaterial> {
  const keyPair = await subtle.generateKey(
    {
      name: RSA_OAEP_ALGORITHM,
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: RSA_PUBLIC_EXPONENT,
      hash: RSA_HASH,
    },
    true,
    ['wrapKey', 'unwrapKey'],
  ) as WebCryptoKeyPair

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    subtle.exportKey('jwk', keyPair.publicKey),
    subtle.exportKey('jwk', keyPair.privateKey),
  ])

  return {
    publicKeyJwk: publicKeyJwk as RsaOaepPublicKeyMaterial,
    privateKeyJwk: privateKeyJwk as RsaOaepPrivateKeyMaterial,
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
