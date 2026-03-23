'use client'

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-community/firebase-analytics';

export default function NativeAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 네이티브 앱(iOS/Android) 환경에서만 파이어베이스 애널리틱스 초기화
    if (Capacitor.isNativePlatform()) {
      FirebaseAnalytics.initializeFirebase()
        .then(() => setIsSupported(true))
        .catch((e: unknown) => console.log('Firebase Analytics INIT Error:', e));
    }
  }, []);

  useEffect(() => {
    if (isSupported && pathname) {
      // 앱 내 경로 이동 시, 커스텀 이벤트 및 스크린 지정
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      
      FirebaseAnalytics.setScreenName({
        screenName: pathname,
        screenClassOverride: 'NextJS_AppRouter'
      }).catch((e: unknown) => console.log('FA Screen Tracking Error:', e));

      FirebaseAnalytics.logEvent({
        name: 'page_view',
        params: { page_path: url, page_title: pathname }
      }).catch((e: unknown) => console.log('FA Page View Tracking Error:', e));
    }
  }, [pathname, searchParams, isSupported]);

  return null; // 시각적 UI가 없는 백그라운드 모니터링 컴포넌트
}
