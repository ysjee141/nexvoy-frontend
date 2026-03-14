import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const NativeUIService = {
    async initialize() {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // 1. 상태바(Status Bar) 설정
            // 앱의 배경색(#fbfbfb)이 밝은 톤이므로, 글자색은 어둡게(Style.Dark) 설정
            await StatusBar.setStyle({ style: Style.Dark });
            
            if (Capacitor.getPlatform() === 'android') {
                // 안드로이드 상단 바 배경색 지정 (흰색 계열)
                await StatusBar.setBackgroundColor({ color: '#fbfbfb' });
            }
            
            console.log('Native UI Initialized successfully');
        } catch (error) {
            console.warn('Failed to initialize Native UI:', error);
        }
    }
}
