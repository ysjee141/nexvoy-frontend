import { premiumService, UserProfile } from './PremiumService';

/**
 * Ad Service
 * 광고 노출 여부 및 AdMob과 같은 광고 SDK 연동 로직을 담당합니다.
 * AI 가이드의 '수익화 레이어 추상화' 원칙을 준수합니다.
 */

class AdService {
  /**
   * 광고 노출 여부를 결정합니다. 
   * 프리미엄 사용자에게는 광고를 노출하지 않습니다.
   * @param profile 사용자 프로필 정보
   * @returns 광고 노출 여부
   */
  public shouldShowAds(profile: UserProfile | null | undefined): boolean {
    // 1. 프리미엄 사용자 여부 확인
    const isPremium = premiumService.isPremium(profile);
    
    // 2. 프리미엄이 아니면 광고 로출
    return !isPremium;
  }

  /**
   * TODO: 향후 AdMob SDK 연동 시 초기화 로직 구현
   */
  public async initialize(): Promise<void> {
    console.log('[AdService] AdMob initialization deferred until official release.');
  }

  /**
   * TODO: 배너 광고 노출 처리
   */
  public showBanner(): void {
    console.log('[AdService] showBanner called.');
  }

  /**
   * TODO: 전면 광고(Interstitial Ad) 노출 처리
   */
  public async showInterstitial(): Promise<void> {
    console.log('[AdService] showInterstitial called.');
  }
}

export const adService = new AdService();
