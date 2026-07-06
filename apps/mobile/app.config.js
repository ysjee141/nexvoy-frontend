const fs = require('fs')
const path = require('path')
const appJson = require('./app.json')

const projectRoot = __dirname
const androidGoogleServicesFile = './google-services.json'
const iosGoogleServicesFile = './GoogleService-Info.plist'

function fileExists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath))
}

module.exports = () => {
  const config = JSON.parse(JSON.stringify(appJson.expo))
  const hasAndroidFirebaseConfig = fileExists(androidGoogleServicesFile)
  const hasIosFirebaseConfig = fileExists(iosGoogleServicesFile)

  config.plugins = [
    ...(config.plugins ?? []),
    'expo-build-properties',
    'react-native-quick-crypto',
  ]

  if (hasAndroidFirebaseConfig || hasIosFirebaseConfig) {
    config.plugins = [
      ...(config.plugins ?? []),
      '@react-native-firebase/app',
    ]
    config.android = {
      ...(config.android ?? {}),
      ...(hasAndroidFirebaseConfig ? { googleServicesFile: androidGoogleServicesFile } : {}),
    }
    config.ios = {
      ...(config.ios ?? {}),
      ...(hasIosFirebaseConfig ? { googleServicesFile: iosGoogleServicesFile } : {}),
    }
  }

  return config
}
