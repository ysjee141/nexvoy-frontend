Pod::Spec.new do |s|
  s.name           = 'OnvoyNativeCrypto'
  s.version        = '0.1.0'
  s.summary        = 'OnVoy native non-exportable RSA key provider'
  s.description    = 'Android Keystore and iOS Keychain backed RSA-OAEP private key operations for OnVoy.'
  s.author         = 'OnVoy'
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
