const { subtle, randomFillSync } = require('react-native-quick-crypto')

const webcrypto = {
  ensureSecure() {
    return undefined
  },
  subtle,
  getRandomValues(array) {
    return randomFillSync(array)
  },
}

module.exports = webcrypto
