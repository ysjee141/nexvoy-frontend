import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'xyz.nexvoy.app',
  appName: 'Next Voyage',
  webDir: 'out',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
  server: {
    cleartext: true,
    iosScheme: 'capacitor',
    androidScheme: 'http'
  }
};

export default config;
