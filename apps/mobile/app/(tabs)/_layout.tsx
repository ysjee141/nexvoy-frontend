/**
 * 탭 네비게이션 — 웹 BottomNavbar 동형.
 * 3탭: 홈 / 체크리스트 / 프로필 (초기 셋업 골격, 템플릿 탭은 후속 P2-6).
 * 활성 탭만 primary 컬러(10% 룰). 상단 hairline 으로 웹 shadows.nav 재표현.
 */
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet } from 'react-native'
import { colors, fontSizes, fontWeights } from '@/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.brand.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.canvas,
          borderTopColor: colors.brand.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: fontSizes.xs,
          fontWeight: fontWeights.medium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          title: '체크리스트',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'checkbox' : 'checkbox-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
