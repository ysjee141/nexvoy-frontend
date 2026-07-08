import CryptoKit
import ExpoModulesCore
import Foundation
import Security

public class OnvoyNativeCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnvoyNativeCrypto")

    AsyncFunction("ensureKey") { (deviceId: String) in
      let tag = self.keyTag(deviceId: deviceId)
      let privateKey = try self.loadPrivateKey(tag: tag) ?? self.generatePrivateKey(tag: tag)
      return try self.keyInfo(privateKey: privateKey)
    }

    AsyncFunction("getPublicKeyJwk") { (deviceId: String) in
      let tag = self.keyTag(deviceId: deviceId)
      guard let privateKey = try self.loadPrivateKey(tag: tag) else {
        throw NativeCryptoError.nativeKeyUnavailable
      }
      return try self.keyInfo(privateKey: privateKey)
    }

    AsyncFunction("unwrapDek") { (deviceId: String, wrappedDek: [Int]) in
      let tag = self.keyTag(deviceId: deviceId)
      guard let privateKey = try self.loadPrivateKey(tag: tag) else {
        throw NativeCryptoError.nativeKeyUnavailable
      }
      let ciphertext = Data(wrappedDek.map { UInt8($0 & 0xff) })
      var error: Unmanaged<CFError>?
      guard let plaintext = SecKeyCreateDecryptedData(
        privateKey,
        .rsaEncryptionOAEPSHA256,
        ciphertext as CFData,
        &error
      ) as Data? else {
        throw NativeCryptoError.unwrapFailed
      }
      return Array(plaintext).map { Int($0) }
    }

    AsyncFunction("deleteKey") { (deviceId: String) in
      let query = self.keyQuery(tag: self.keyTag(deviceId: deviceId), returnRef: false)
      let status = SecItemDelete(query as CFDictionary)
      return status == errSecSuccess
    }

    AsyncFunction("hasKey") { (deviceId: String) in
      try self.loadPrivateKey(tag: self.keyTag(deviceId: deviceId)) != nil
    }
  }

  private func keyInfo(privateKey: SecKey) throws -> [String: Any?] {
    guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
      throw NativeCryptoError.nativeKeyUnavailable
    }
    var error: Unmanaged<CFError>?
    guard let representation = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
      throw NativeCryptoError.publicKeyUnavailable
    }
    let components = try RsaPublicKeyDerParser.parse(Array(representation))
    return [
      "publicKeyJwk": [
        "kty": "RSA",
        "alg": "RSA-OAEP-256",
        "key_ops": ["wrapKey"],
        "ext": true,
        "n": base64Url(components.modulus),
        "e": base64Url(components.exponent),
      ],
      "platform": "ios",
      "hardwareBacked": false,
      "attestationStatus": "not_supported",
    ]
  }

  private func loadPrivateKey(tag: Data) throws -> SecKey? {
    var item: CFTypeRef?
    let status = SecItemCopyMatching(keyQuery(tag: tag, returnRef: true) as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    if status != errSecSuccess {
      throw NativeCryptoError.nativeKeyUnavailable
    }
    return (item as! SecKey)
  }

  private func generatePrivateKey(tag: Data) throws -> SecKey {
    let attributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
      kSecAttrKeySizeInBits as String: 2048,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: tag,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        kSecAttrIsExtractable as String: false,
      ],
    ]
    var error: Unmanaged<CFError>?
    guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
      throw NativeCryptoError.keyGenerationFailed
    }
    return privateKey
  }

  private func keyQuery(tag: Data, returnRef: Bool) -> [String: Any] {
    [
      kSecClass as String: kSecClassKey,
      kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
      kSecAttrApplicationTag as String: tag,
      kSecReturnRef as String: returnRef,
    ]
  }

  private func keyTag(deviceId: String) -> Data {
    let digest = SHA256.hash(data: Data(deviceId.utf8)).map { String(format: "%02x", $0) }.joined()
    return Data("xyz.nexvoy.app.mobile_rsa.\(digest)".utf8)
  }
}

private enum NativeCryptoError: Error {
  case keyGenerationFailed
  case nativeKeyUnavailable
  case publicKeyUnavailable
  case unwrapFailed
}

private struct RsaPublicKeyComponents {
  let modulus: [UInt8]
  let exponent: [UInt8]
}

private enum RsaPublicKeyDerParser {
  static func parse(_ bytes: [UInt8]) throws -> RsaPublicKeyComponents {
    let outer = try DerReader(bytes).readElement(expectedTag: 0x30)
    let outerReader = DerReader(outer)
    if outerReader.peekTag() == 0x02 {
      return try parsePkcs1(outer)
    }
    if outerReader.peekTag() == 0x30 {
      _ = try outerReader.readElement(expectedTag: 0x30)
      let bitString = try outerReader.readElement(expectedTag: 0x03)
      return try parsePkcs1(Array(bitString.dropFirst()))
    }
    throw NativeCryptoError.publicKeyUnavailable
  }

  private static func parsePkcs1(_ bytes: [UInt8]) throws -> RsaPublicKeyComponents {
    let reader = DerReader(bytes)
    if reader.peekTag() == 0x30 {
      let sequence = try reader.readElement(expectedTag: 0x30)
      return try parsePkcs1(sequence)
    }
    let modulus = stripLeadingZero(try reader.readElement(expectedTag: 0x02))
    let exponent = stripLeadingZero(try reader.readElement(expectedTag: 0x02))
    return RsaPublicKeyComponents(modulus: modulus, exponent: exponent)
  }

  private static func stripLeadingZero(_ bytes: [UInt8]) -> [UInt8] {
    var value = bytes
    while value.first == 0 && value.count > 1 {
      value.removeFirst()
    }
    return value
  }
}

private final class DerReader {
  private let bytes: [UInt8]
  private var offset = 0

  init(_ bytes: [UInt8]) {
    self.bytes = bytes
  }

  func peekTag() -> UInt8? {
    guard offset < bytes.count else { return nil }
    return bytes[offset]
  }

  func readElement(expectedTag: UInt8) throws -> [UInt8] {
    guard offset < bytes.count, bytes[offset] == expectedTag else {
      throw NativeCryptoError.publicKeyUnavailable
    }
    offset += 1
    let length = try readLength()
    guard offset + length <= bytes.count else {
      throw NativeCryptoError.publicKeyUnavailable
    }
    let value = Array(bytes[offset..<offset + length])
    offset += length
    return value
  }

  private func readLength() throws -> Int {
    guard offset < bytes.count else {
      throw NativeCryptoError.publicKeyUnavailable
    }
    let first = bytes[offset]
    offset += 1
    if first & 0x80 == 0 {
      return Int(first)
    }
    let count = Int(first & 0x7f)
    guard count > 0, count <= 4, offset + count <= bytes.count else {
      throw NativeCryptoError.publicKeyUnavailable
    }
    var length = 0
    for _ in 0..<count {
      length = (length << 8) | Int(bytes[offset])
      offset += 1
    }
    return length
  }
}

private func base64Url(_ bytes: [UInt8]) -> String {
  Data(bytes)
    .base64EncodedString()
    .replacingOccurrences(of: "+", with: "-")
    .replacingOccurrences(of: "/", with: "_")
    .replacingOccurrences(of: "=", with: "")
}
