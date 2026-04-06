import { Capacitor, CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';

export interface ApiRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

class ApiService {
  private readonly defaultTimeout = 10000; // 10 seconds
  private readonly baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  /**
   * 보정된 절대 경로 URL을 반환합니다.
   */
  private getAbsoluteUrl(url: string): string {
    if (url.startsWith('http')) return url;
    // 상대 경로(/api/...)를 절대 경로(https://.../api/...)로 변환
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${this.baseUrl}${cleanUrl}`;
  }

  /**
   * 핵심 요청 메서드
   */
  public async request<T = any>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const isNative = Capacitor.isNativePlatform();
    const fullUrl = this.getAbsoluteUrl(options.url);
    const method = options.method || 'GET';
    const timeout = options.timeout || this.defaultTimeout;

    if (isNative) {
      const httpOptions: HttpOptions = {
        url: fullUrl,
        method: method,
        data: options.data,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        params: options.params,
        connectTimeout: timeout,
        readTimeout: timeout,
      };

      try {
        const response: HttpResponse = await CapacitorHttp.request(httpOptions);
        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
        };
      } catch (error) {
        console.error('[ApiService] Native Request Error:', error);
        throw error;
      }
    } else {
      // Web 환경: standard fetch
      const urlObj = new URL(fullUrl);
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          urlObj.searchParams.append(key, value);
        });
      }

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const requestHeaders: Record<string, string> = { ...options.headers };
        const isFormData = options.data instanceof FormData;

        if (!isFormData) {
          requestHeaders['Content-Type'] = 'application/json';
        }

        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          body: isFormData ? options.data : (options.data ? JSON.stringify(options.data) : undefined),
          signal: controller.signal,
        };

        const response = await fetch(urlObj.toString(), fetchOptions);
        clearTimeout(id);

        const data = await response.json().catch(() => ({}));
        
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          data,
          status: response.status,
          headers,
        };
      } catch (error) {
        clearTimeout(id);
        console.error('[ApiService] Web Request Error:', error);
        throw error;
      }
    }
  }

  // 편의 메서드들
  public async get<T = any>(url: string, params?: Record<string, string>, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET', params });
  }

  public async post<T = any>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'POST', data });
  }

  public async put<T = any>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'PUT', data });
  }

  public async delete<T = any>(url: string, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }
}

export const apiService = new ApiService();
