/**
 * 인증 스택 — 비인증 그룹 (login / 향후 signup, callback).
 */
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
