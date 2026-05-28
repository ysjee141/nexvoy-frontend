import { apiService } from './ApiService';
import { Capacitor } from '@capacitor/core';
import { CacheUtil } from '@/utils/cache';

/**
 * 환율 정보 서비스
 */
export const ExchangeService = {
  getExchangeRate: async (fromCode: string) => {
    const cacheKey = `exchange_rate_${fromCode}`;
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

    try {
      // 1. 로컬 캐시 확인
      const cached = await CacheUtil.get<{ rate: number; timestamp: number }>(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return { from: fromCode, to: 'KRW', rate: cached.rate };
      }

      // 2. 서버 호출
      const response = await apiService.get(`/api/exchange/`, { from: fromCode });
      const data = response.data;

      if (data && data.rate) {
        // 3. 캐시 업데이트
        await CacheUtil.set(cacheKey, { rate: data.rate, timestamp: Date.now() });
      }
      return data;
    } catch (error) {
      console.warn('[ExchangeService] Failed to fetch, trying stale cache...', error);
      // 4. 실패 시 (오프라인 등) 만료된 캐시라도 있다면 반환
      const stale = await CacheUtil.get<{ rate: number; timestamp: number }>(cacheKey);
      if (stale) {
        return { from: fromCode, to: 'KRW', rate: stale.rate, isStale: true };
      }
      throw error;
    }
  }
};

/**
 * 위치 및 타임존 서비스
 */
export const LocationService = {
  getTimezone: async (lat: number, lng: number) => {
    const response = await apiService.get(`/api/timezone/`, { 
      lat: lat.toString(), 
      lng: lng.toString() 
    });
    return response.data;
  },

  /**
   * 위경도 좌표로 주소 정보 가져오기 (Google Maps Geocoding API)
   */
  getAddress: async (lat: number, lng: number) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    // External API 호출이므로 apiService.request 사용
    const response = await apiService.request({
      url: `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ko&key=${apiKey}`,
      method: 'GET'
    });
    return response.data;
  }
};

/**
 * Google Places 사진 서비스
 *
 * `getPhoto`: 미리보기 URL과 영구 저장에 필요한 `photoReference`를 동시에 반환.
 */
export interface PlacePhotoResponse {
  url: string | null;
  photoReference: string | null;
}

export const PlacePhotoService = {
  /**
   * 미리보기 URL + photoReference 동시 조회.
   * NewPlanModal이 plans INSERT 시 `photo_reference` 컬럼에 저장하기 위한 용도.
   */
  getPhoto: async (
    placeId: string,
    maxwidth = 400,
  ): Promise<PlacePhotoResponse> => {
    try {
      const response = await apiService.get<PlacePhotoResponse>('/api/places/photo/', {
        placeId,
        maxwidth: String(maxwidth),
      });
      return {
        url: response.data?.url ?? null,
        photoReference: response.data?.photoReference ?? null,
      };
    } catch (error) {
      console.error('[PlacePhotoService] Failed to fetch photo metadata:', error);
      return { url: null, photoReference: null };
    }
  }
};

/**
 * 협업 및 초대 서비스
 */
export const CollaborationService = {
  createInvite: async (data: { email: string; tripTitle: string; tripId: string }) => {
    const response = await apiService.post(`/api/invite/`, data);
    return response.data;
  }
};

/**
 * 메타데이터(OG-Preview) 서비스
 */
export const MetadataService = {
  getOgPreview: async (url: string) => {
    // 앱에서도 정상 작동하도록 절대 경로 기반으로 호출 (ApiService가 처리)
    const response = await apiService.get(`/api/og-preview/`, { 
      url: url 
    });
    return response.data;
  }
};
