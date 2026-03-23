'use client'

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-community/firebase-analytics';

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 네이티브 앱(iOS/Android) 환경에서만 파이어베이스 애널리틱스 초기화
    if (Capacitor.isNativePlatform()) {
      // 네이티브 빌드 시에는 google-services.json / GoogleService-Info.plist가 이미 포함되어 있으므로
      // 빈 객체를 넘기거나 캐스팅하여 초기화합니다.
      (FirebaseAnalytics as any).initializeFirebase({})
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
      }).catch((e: unknown) => console.log('FA Screen Tracking Error:', e));

      FirebaseAnalytics.logEvent({
        name: 'page_view',
        params: { page_path: url, page_title: pathname }
      }).catch((e: unknown) => console.log('FA Page View Tracking Error:', e));
    }
  }, [pathname, searchParams, isSupported]);

  return null;
}

export default function NativeAnalytics() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  )
}
