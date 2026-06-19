/**
 * nexvoy-app 테마 진입점.
 * design-tokens(SSOT)의 값을 그대로 re-export 하고, RN 전용 어댑터(shadows)를 합친다.
 * 화면 코드는 여기(`@/theme`)에서 토큰을 가져온다.
 */
export { colors, radii, spacing, fontSizes, fontWeights } from '@nexvoy/design-tokens'
export { shadows } from './shadows'
