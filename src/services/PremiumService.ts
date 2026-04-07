/**
 * Premium Service
 * 프리미엄 사용자 여부를 판단하는 로직을 담당합니다.
 * AI 가이드의 '서비스 레이어 추상화' 원칙을 준수합니다.
 */

export interface UserProfile {
  id: string;
  premium_until?: string | null;
  [key: string]: any;
}

class PremiumService {
  /**
   * 사용자의 프리미엄 상태를 확인합니다.
   * @param profile 사용자 프로필 정보 (premium_until 포함)
   * @returns 프리미엄 여부
   */
  public isPremium(profile: UserProfile | null | undefined): boolean {
    if (!profile || !profile.premium_until) {
      return false;
    }

    const premiumUntilDate = new Date(profile.premium_until);
    const now = new Date();

    // 프리미엄 종료일이 현재보다 미래라면 프리미엄 상태로 간주
    return premiumUntilDate > now;
  }

  /**
   * 남은 프리미엄 기간을 일 수로 반환합니다.
   * @param profile 사용자 프로필 정보
   * @returns 남은 일 수 (프리미엄이 아니면 0)
   */
  public getRemainingDays(profile: UserProfile | null | undefined): number {
    if (!profile || !this.isPremium(profile)) {
      return 0;
    }

    const premiumUntilDate = new Date(profile.premium_until!);
    const now = new Date();
    const diffTime = premiumUntilDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export const premiumService = new PremiumService();
