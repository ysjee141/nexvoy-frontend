import { useEffect, useState } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'applying' | 'mandatory_update' | 'error';

export function useOTAUpdate() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        // 1. Notify that the current app is ready (prevent rollback)
        await CapacitorUpdater.notifyAppReady();

        setStatus('checking');

        // 2. Get current app info
        const info = await App.getInfo();
        const currentVersion = info.version;
        const currentBuild = info.build;

        // 3. Fetch latest version from Supabase for the current channel
        const currentChannel = process.env.NEXT_PUBLIC_APP_ENV || 'production';
        const { data: latestVersion, error: fetchError } = await supabase
          .from('app_versions')
          .select('*')
          .eq('is_active', true)
          .eq('channel', currentChannel)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError || !latestVersion) {
          console.log('No update available or error fetching:', fetchError);
          setStatus('idle');
          return;
        }

        // 4. Check native version compatibility
        if (latestVersion.min_native_version) {
          const isNativeVersionSupported = compareVersions(currentVersion, latestVersion.min_native_version) >= 0;
          if (!isNativeVersionSupported) {
            setStatus('mandatory_update');
            return;
          }
        }

        // 5. Compare versions (simple string comparison for now, can be improved)
        if (latestVersion.version === currentVersion) {
          // Already on latest version (or at least same version tag)
          // But we might need more granular check if needed
          setStatus('idle');
          return;
        }

        // 6. Download update
        setStatus('downloading');

        const removeListener = await CapacitorUpdater.addListener('download', (data: { percent: number }) => {
          setProgress(data.percent);
        });

        const bundle = await CapacitorUpdater.download({
          url: latestVersion.bundle_url,
          version: latestVersion.version,
        });

        removeListener.remove();

        // 7. Apply update
        setStatus('applying');
        await CapacitorUpdater.set({ id: bundle.id });

        // App will reload automatically
      } catch (err) {
        console.error('OTA Update failed:', err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    };

    // Only run on native platforms
    App.getInfo().then((info) => {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        checkUpdate();
      }
    });

  }, []);

  useEffect(() => {
    if (status === 'idle' || status === 'error') {
      SplashScreen.hide();
    }
  }, [status]);

  return { status, progress, error };
}

// Simple semver-like comparison
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const val1 = parts1[i] || 0;
    const val2 = parts2[i] || 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
}
