import { StatusBar, Style } from '@capacitor/status-bar';
// @ts-ignore: User will install @capgo/capacitor-navigation-bar locally
import { NavigationBar } from '@capgo/capacitor-navigation-bar';
import { Capacitor } from '@capacitor/core';

/**
 * 네이티브 플랫폼(iOS/Android)의 시스템 UI(상태바, 네비게이션 바) 설정을 담당하는 서비스.
 *
 * ## Android 15+ (targetSdkVersion 36) 제한사항
 *
 * Android 15부터 edge-to-edge 모드가 강제 적용되어 앱 컨텐츠가 시스템 바 뒤까지 렌더링됩니다.
 * - `StatusBar.setBackgroundColor()` 및 `NavigationBar.setNavigationBarColor()`는
 *   시스템 바의 반투명 오버레이 색상만 변경하며, 앱 컨텐츠 영역을 축소하지 않습니다.
 * - Android WebView에서는 `env(safe-area-inset-*)` CSS 함수가 항상 0px을 반환합니다.
 * - Capacitor 8.x SystemBars 플러그인이 `--safe-area-inset-*` CSS 변수를 주입하므로,
 *   CSS에서 `max(env(safe-area-inset-*), var(--safe-area-inset-*))` 패턴으로 폴백 처리합니다.
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
