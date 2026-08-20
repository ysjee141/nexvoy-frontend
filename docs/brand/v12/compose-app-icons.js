// Compatibility entry point. Approved variants are now composed from the
// accepted candidate so the legacy VTracer trace cannot overwrite canonical assets.
const { main } = require('./apply-approved-assets')

main()
