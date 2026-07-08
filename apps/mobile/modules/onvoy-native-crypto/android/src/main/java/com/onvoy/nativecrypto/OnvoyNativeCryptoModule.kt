package com.onvoy.nativecrypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.MGF1ParameterSpec
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import android.util.Base64

class OnvoyNativeCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OnvoyNativeCrypto")

    AsyncFunction("ensureKey") { deviceId: String ->
      val alias = keyAlias(deviceId)
      val keyStore = loadKeyStore()
      if (!keyStore.containsAlias(alias)) {
        generateKeyPair(alias)
      }
      keyInfo(alias)
    }

    AsyncFunction("getPublicKeyJwk") { deviceId: String ->
      val alias = keyAlias(deviceId)
      if (!loadKeyStore().containsAlias(alias)) {
        throw IllegalStateException("native_key_unavailable")
      }
      keyInfo(alias)
    }

    AsyncFunction("unwrapDek") { deviceId: String, wrappedDek: List<Int> ->
      val alias = keyAlias(deviceId)
      val privateKey = loadPrivateKey(alias) ?: throw IllegalStateException("native_key_unavailable")
      val cipher = Cipher.getInstance("RSA/ECB/OAEPPadding")
      cipher.init(Cipher.DECRYPT_MODE, privateKey, oaepSha256Spec())
      cipher.doFinal(wrappedDek.map { it.toByte() }.toByteArray()).map { it.toInt() and 0xff }
    }

    AsyncFunction("deleteKey") { deviceId: String ->
      val alias = keyAlias(deviceId)
      val keyStore = loadKeyStore()
      if (!keyStore.containsAlias(alias)) return@AsyncFunction false
      keyStore.deleteEntry(alias)
      true
    }

    AsyncFunction("hasKey") { deviceId: String ->
      loadKeyStore().containsAlias(keyAlias(deviceId))
    }
  }

  private fun generateKeyPair(alias: String) {
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEYSTORE)
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(RSA_KEY_SIZE)
      .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
      .setUserAuthenticationRequired(false)
      .build()
    generator.initialize(spec)
    generator.generateKeyPair()
  }

  private fun keyInfo(alias: String): Map<String, Any?> {
    val certificate = loadKeyStore().getCertificate(alias) ?: throw IllegalStateException("native_key_unavailable")
    val publicKey = certificate.publicKey as? RSAPublicKey ?: throw IllegalStateException("native_key_unavailable")
    val privateKey = loadPrivateKey(alias)

    return mapOf(
      "publicKeyJwk" to publicJwk(publicKey),
      "platform" to "android",
      "hardwareBacked" to hardwareBacked(privateKey),
      "attestationStatus" to "not_verified",
    )
  }

  private fun publicJwk(publicKey: RSAPublicKey): Map<String, Any> {
    return mapOf(
      "kty" to "RSA",
      "alg" to "RSA-OAEP-256",
      "key_ops" to listOf("wrapKey"),
      "ext" to true,
      "n" to base64Url(publicKey.modulus),
      "e" to base64Url(publicKey.publicExponent),
    )
  }

  private fun hardwareBacked(privateKey: PrivateKey?): Boolean? {
    if (privateKey == null) return null
    return try {
      val factory = KeyFactory.getInstance(privateKey.algorithm, ANDROID_KEYSTORE)
      val keyInfo = factory.getKeySpec(privateKey, KeyInfo::class.java)
      keyInfo.isInsideSecureHardware
    } catch (_: Exception) {
      null
    }
  }

  private fun loadPrivateKey(alias: String): PrivateKey? {
    return loadKeyStore().getKey(alias, null) as? PrivateKey
  }

  private fun loadKeyStore(): KeyStore {
    return KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
  }

  private fun keyAlias(deviceId: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
      .digest(deviceId.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
    return "$KEY_ALIAS_PREFIX$digest"
  }

  private fun base64Url(value: BigInteger): String {
    val bytes = value.toByteArray().dropWhile { it.toInt() == 0 }.toByteArray()
    return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
  }

  private fun oaepSha256Spec(): OAEPParameterSpec {
    return OAEPParameterSpec(
      "SHA-256",
      "MGF1",
      MGF1ParameterSpec.SHA256,
      PSource.PSpecified.DEFAULT,
    )
  }

  companion object {
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS_PREFIX = "xyz.nexvoy.app.mobile_rsa."
    private const val RSA_KEY_SIZE = 2048
  }
}
