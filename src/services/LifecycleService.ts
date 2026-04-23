import { Capacitor } from '@capacitor/core';
import { createClient, resetNativeClient } from '@/utils/supabase/client';

/**
 * 앱의 생명주기(Foreground/Background)를 관리하는 서비스
 */
export const LifecycleService = {
    async initialize() {
        console.log('--- Lifecycle Service Initialization: REGISTERING LISTENERS ---');

        // 1. Web API fallback (모든 플랫폼 공통)
        document.addEventListener('visibilitychange', () => {
            const state = document.visibilityState;
            console.log(`[Lifecycle] Document visibility changed: ${state}`);
            if (state === 'visible') {
                this.handleResume('WebVisibility');
            } else {
                this.handlePause('WebVisibility');
            }
        });

        // 2. Native App Plugin
        if (Capacitor.isNativePlatform()) {
            try {
                // @ts-ignore
                const { App } = await import('@capacitor/app');
                
                // 앱 상에서 돌아왔을 때 가장 확실하게 불리는 이벤트
                App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
                    console.log(`[Lifecycle] Capacitor App state: ${isActive ? 'Active' : 'Inactive'}`);
                    if (isActive) {
                        this.handleResume('CapacitorApp');
                    } else {
                        this.handlePause('CapacitorApp');
                    }
                });

                // URL을 통해 앱이 열렸을 때 (딥링크 등도 포함)
                App.addListener('appUrlOpen', async (data: any) => {
                    console.log(`[Lifecycle] App opened with URL: ${data.url}`);
                    
                    // ─── OAuth 세션 브릿지 처리 ─────────────────────────────
                    if (data.url.includes('onvoy://auth/callback')) {
                        try {
                            const url = new URL(data.url.replace('#', '?')); // URLSearchParams가 fragment를 읽지 못하므로 변환
                            const access_token = url.searchParams.get('access_token');
                            const refresh_token = url.searchParams.get('refresh_token');
                            
                            if (access_token && refresh_token) {
                                console.log('[Lifecycle] Auth tokens detected in deep link. Syncing session...');
                                const supabase = createClient();
                                const { error } = await supabase.auth.setSession({
                                    access_token,
                                    refresh_token
                                });
                                
                                if (error) {
                                    console.error('[Lifecycle] Sync session error:', error.message);
                                } else {
                                    console.log('[Lifecycle] Session synced successfully. Refreshing UI...');
                                    window.dispatchEvent(new Event('focus')); // UI 갱신 유도
                                }
                            }
                        } catch (err) {
                            console.error('[Lifecycle] Error parsing deep link URL:', err);
                        }
                    }

                    this.handleResume('AppUrlOpen');
                });

                // 안드로이드 하드웨어 뒤로가기 버튼 처리
                App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
                    console.log(`[Lifecycle] Back button pressed. canGoBack: ${canGoBack}`);
                    if (canGoBack) {
                        window.history.back();
                    } else {
                        // 더 이상 뒤로 갈 곳이 없거나 홈이면 앱 최소화
                        console.log('[Lifecycle] No more history, minimizing app');
                        App.minimizeApp();
                    }
                });

                console.log('[Lifecycle] Native listeners registered successfully.');
            } catch (e) {
                console.warn('[Lifecycle] Capacitor App plugin failed to load:', e);
            }
        }
    },

    /**
     * 앱이 포그라운드로 복귀했을 때의 로직
     */
    async handleResume(source: string) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[Lifecycle][${timestamp}] RECOVERY STARTED (Source: ${source})`);
        
        try {
            // STEP 1: UI & JS Event Loop 깨우기 (동기적으로 즉시 수행)
            console.log('[Lifecycle] STEP 1: UI Wake-up');
            window.dispatchEvent(new Event('focus'));
            window.dispatchEvent(new Event('online')); // 네트워크 상태 갱신 유도
            
            // 미세한 리플로우 유도 (화면 갱신 강제)
            const body = document.body;
            const originalOpacity = body.style.opacity;
            body.style.opacity = '0.99';
            setTimeout(() => {
                body.style.opacity = originalOpacity || '1';
                console.log('[Lifecycle] UI Reflow finished');
            }, 100);

            // STEP 2: Supabase 세션 체크 (OS가 완전히 깨어날 수 있도록 500ms 지연)
            console.log('[Lifecycle] STEP 2: Delayed Session Recovery initiated');
            setTimeout(() => {
                this.refreshSession();
            }, 500);

            console.log(`[Lifecycle][${timestamp}] RECOVERY FLOW FINISHED (Source: ${source})`);
        } catch (e) {
            console.error('[Lifecycle] Error during app resume handler:', e);
        }
    },

    async refreshSession() {
        try {
            console.log('[Lifecycle] refreshSession: Resetting Supabase client...');
            // 네이티브에서 싱글톤 클라이언트가 먹통이 되는 경우를 대비해 초기화
            if (Capacitor.isNativePlatform()) {
                resetNativeClient();
            }
            
            console.log('[Lifecycle] refreshSession: Calling getSession...');
            const supabase = createClient();
            
            // 타임아웃을 두어 getSession이 무한정 대기하는 것을 방지
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('getSession Timeout')), 5000)
            );

            const { data, error }: any = await Promise.race([sessionPromise, timeoutPromise]);
            
            if (error) {
                console.error('[Lifecycle] refreshSession Error:', error);
            } else if (data?.session) {
                console.log('[Lifecycle] refreshSession: Valid session found for', data.session.user.email);
            } else {
                console.log('[Lifecycle] refreshSession: No active session');
            }
        } catch (e) {
            console.warn('[Lifecycle] refreshSession caught exception/timeout:', e);
        }
    },

    handlePause(source: string) {
        console.log(`[Lifecycle] App Paused (Source: ${source})`);
    }
}
