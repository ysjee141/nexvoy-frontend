import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'xyz.nexvoy.app',
  appName: 'NexVoy',
  webDir: 'out',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    cleartext: true,
    iosScheme: 'capacitor',
    androidScheme: 'http'
  }
};

export default config;
