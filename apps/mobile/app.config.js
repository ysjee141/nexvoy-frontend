const fs = require('fs')
const path = require('path')
const appJson = require('./app.json')

const projectRoot = __dirname
const androidGoogleServicesFile = './google-services.json'
const iosGoogleServicesFile = './GoogleService-Info.plist'

function fileExists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath))
}

function addUnique(values, nextValue) {
  const current = Array.isArray(values) ? values : []
  return current.includes(nextValue) ? current : [...current, nextValue]
}

module.exports = () => {
  const config = JSON.parse(JSON.stringify(appJson.expo))
  const hasAndroidFirebaseConfig = fileExists(androidGoogleServicesFile)
  const hasIosFirebaseConfig = fileExists(iosGoogleServicesFile)

  config.plugins = [
    ...(config.plugins ?? []),
    'expo-background-task',
    'expo-build-properties',
    'expo-sqlite',
    'react-native-quick-crypto',
  ]

  config.ios = {
    ...(config.ios ?? {}),
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      UIBackgroundModes: addUnique(config.ios?.infoPlist?.UIBackgroundModes, 'processing'),
      BGTaskSchedulerPermittedIdentifiers: addUnique(
        config.ios?.infoPlist?.BGTaskSchedulerPermittedIdentifiers,
        'com.expo.modules.backgroundtask.processing',
      ),
    },
  }

  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  if (googleMapsApiKey) {
    config.android = {
      ...(config.android ?? {}),
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: { apiKey: googleMapsApiKey },
      },
    }
    config.ios = {
      ...(config.ios ?? {}),
      config: {
        ...(config.ios?.config ?? {}),
        googleMapsApiKey,
      },
    }
  }

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
