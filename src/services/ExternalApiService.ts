import { apiService } from './ApiService';
import { Capacitor } from '@capacitor/core';

/**
 * 환율 정보 서비스
 */
export const ExchangeService = {
  getExchangeRate: async (fromCode: string) => {
    const response = await apiService.get(`/api/exchange/`, { from: fromCode });
    return response.data;
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
      url: encodeURIComponent(url) 
    });
    return response.data;
  }
};
