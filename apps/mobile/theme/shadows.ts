/**
 * RN 그림자 어댑터
 *
 * @nexvoy/design-tokens 의 `shadows` 는 웹 전용 CSS box-shadow 문자열이라
 * RN 에서 직접 사용할 수 없다. 이 파일에서 동일한 디자인 의미값(card/modal/fab/nav)을
 * RN 그림자 객체(iOS shadow* 4속성 + Android elevation)로 변환한다.
 *
 * 규칙(ADR-009 / planner 결정 3): 화면 코드는 design-tokens의 shadows 문자열을
 * 직접 import 하지 말고 반드시 이 어댑터를 경유한다.
 */
import type { ViewStyle } from 'react-native'
import { colors } from '@nexvoy/design-tokens'

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>

export const shadows: Record<'card' | 'modal' | 'fab', ShadowStyle> = {
  // 웹: 0 2px 12px rgba(0,0,0,0.06)
  card: {
    shadowColor: colors.bg.scrim,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  // 웹: 0 20px 60px rgba(0,0,0,0.15)
  modal: {
    shadowColor: colors.bg.scrim,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 12,
  },
  // 웹: 0 4px 16px rgba(37,99,235,0.35)  — primary 컬러 글로우
  fab: {
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
}

/**
 * 웹 shadows.nav (`0 -1px 0 #E2E8F0`)는 RN에서 그림자 대신 상단 1px hairline 으로 재표현.
 * 탭바 borderTopWidth/borderTopColor 로 처리하므로 별도 객체는 두지 않는다.
 */
