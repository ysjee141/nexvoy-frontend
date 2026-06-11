import type { BrowserContext, Page } from '@playwright/test';

/**
 * Google Maps JS API 결정적 스텁.
 *
 * `@react-google-maps/api`의 `useLoadScript`는 `<script ...&callback=initMap>`을
 * head에 주입하고, **스크립트가 `window.initMap()`을 호출할 때** `isLoaded`를 true로 전환한다.
 * 따라서 이 스텁은 `window.google.maps`를 정의한 뒤 **반드시** 끝에서 `window.initMap()`을
 * 호출해야 한다. (이 호출이 없으면 `isLoaded`가 영원히 false → input enable 무한 대기 → 타임아웃)
 *
 * 또한 `<Autocomplete>` 컴포넌트는 mount 시 `invariant(!!google.maps.places, ...)`로
 * `google.maps.places`가 truthy임을 요구하므로 절대 falsy로 두면 안 된다.
 *
 * 라이브러리/버전 의존 사실:
 * - 콜백명은 `initMap`으로 하드코딩(`@react-google-maps/api` v2.19.3).
 * - 라이브러리가 스크립트 append 전에 `window.initMap`을 자기 resolver로 정의하므로,
 *   스텁 평가 시점에 이미 `window.initMap`이 존재한다.
 */
const GOOGLE_MAPS_STUB = /* js */ `
(function () {
  window.google = window.google || {};
  window.google.maps = {
    places: {
      // <Autocomplete>가 new google.maps.places.Autocomplete(input, opts)로 생성.
      Autocomplete: function (input, opts) {
        this._input = input;
        this._opts = opts;
        // 앱은 getPlace()의 name || formatted_address로 destination을 채운다.
        this.getPlace = function () {
          var value = (input && input.value) || '';
          return { name: value, formatted_address: value };
        };
        this.addListener = function () { return { remove: function () {} }; };
        this.setFields = function () {};
        this.setComponentRestrictions = function () {};
        this.setBounds = function () {};
        this.getBounds = function () { return null; };
      },
      AutocompleteService: function () {
        this.getPlacePredictions = function () { return Promise.resolve({ predictions: [] }); };
      },
    },
    Map: function () {
      this.setOptions = function () {};
      this.fitBounds = function () {};
      this.panTo = function () {};
      this.setCenter = function () {};
      this.setZoom = function () {};
      this.addListener = function () { return { remove: function () {} }; };
    },
    OverlayView: function () {},
    Polyline: function () {
      this.setMap = function () {};
      this.setOptions = function () {};
      this.setPath = function () {};
    },
    Marker: function () {
      this.setMap = function () {};
      this.setPosition = function () {};
      this.addListener = function () { return { remove: function () {} }; };
    },
    LatLngBounds: function () {
      this.extend = function () { return this; };
      this.isEmpty = function () { return true; };
      this.getCenter = function () { return { lat: function () { return 0; }, lng: function () { return 0; } }; };
    },
    LatLng: function (lat, lng) {
      this.lat = function () { return lat; };
      this.lng = function () { return lng; };
    },
    Size: function () {},
    Point: function () {},
    SymbolPath: { CIRCLE: 0, FORWARD_CLOSED_ARROW: 1 },
    event: {
      addListener: function () { return { remove: function () {} }; },
      removeListener: function () {},
      clearInstanceListeners: function () {},
    },
    MapTypeId: { ROADMAP: 'roadmap' },
  };

  // ⚠️ 가장 중요한 불변식: 이 호출이 없으면 useLoadScript의 isLoaded가 영원히 false.
  if (typeof window.initMap === 'function') {
    window.initMap();
  }
})();
`;

/**
 * Maps JS API 스크립트 요청을 결정적 스텁으로 대체한다.
 * BrowserContext에 설치하면 해당 컨텍스트의 모든 page에 일괄 적용된다.
 *
 * `maps/api/js`만 매칭하므로 geocode/photo 등 다른 maps 엔드포인트나
 * fonts.googleapis.com 등 폰트 요청에는 영향을 주지 않는다.
 */
export async function installGoogleMapsMock(target: BrowserContext | Page): Promise<void> {
  await target.route('**/maps.googleapis.com/maps/api/js**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: GOOGLE_MAPS_STUB,
    })
  );
}
