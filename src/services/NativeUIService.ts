import { StatusBar, Style } from '@capacitor/status-bar';
// @ts-ignore: User will install @capgo/capacitor-navigation-bar locally
import { NavigationBar } from '@capgo/capacitor-navigation-bar';
import { Capacitor } from '@capacitor/core';

/**
 * 네이티브 플랫폼(iOS/Android)의 시스템 UI(상태바, 네비게이션 바) 설정을 담당하는 서비스.
 *
 * ## Android Safe Area 처리 구조
 *
 * Android 15+ (targetSdkVersion 36)에서는 edge-to-edge 모드가 강제 적용되어
 * 앱 컨텐츠가 시스템 바 뒤까지 렌더링됩니다.
 *
 * - **CSS 변수 주입**: `MainActivity.java`에서 WindowInsets를 읽어
 *   `--safe-area-inset-*` CSS 변수를 WebView에 직접 주입합니다.
 *   (Capacitor 내장 SystemBars 플러그인의 자동 주입은 타이밍 문제로 비활성화)
 * - **CSS 폴백**: `max(env(safe-area-inset-*), var(--safe-area-inset-*))` 패턴으로
 *   iOS(env)와 Android(var) 모두 호환합니다.
 */
export const NativeUIService = {
    async initialize() {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // 1. 상태바(Status Bar) 설정
            // 앱의 배경색(#fbfbfb)이 밝은 톤이므로, 글자색은 어둡게(Style.Dark) 설정
            await StatusBar.setStyle({ style: Style.Dark });

            if (Capacitor.getPlatform() === 'android') {
                // 안드로이드 상단 바 배경색 지정 (흰색 계열)
                // 참고: Android 15+ edge-to-edge에서는 반투명 오버레이 색상으로만 적용됨
                await StatusBar.setBackgroundColor({ color: '#fbfbfb' });
                // 안드로이드 하단 네비게이션 바 배경색 지정
                // 참고: Android 15+ edge-to-edge에서는 반투명 오버레이 색상으로만 적용됨
                await (NavigationBar as any).setNavigationBarColor({ color: '#fbfbfb', darkButtons: true });
            }

            console.log('Native UI Initialized successfully');
        } catch (error) {
            console.warn('Failed to initialize Native UI:', error);
        }
    }
}
