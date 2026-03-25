'use client'

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { analytics } from '@/services/AnalyticsService';

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 서비스 초기화
    analytics.init().then(() => setIsSupported(true));
  }, []);

  useEffect(() => {
    if (isSupported && pathname) {
      // 앱 내 경로 이동 시, 커스텀 이벤트 및 스크린 지정
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      
       analytics.setScreenName(pathname);
       
       analytics.logEvent('page_view', { 
         page_path: url, 
         page_title: pathname 
       });
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
