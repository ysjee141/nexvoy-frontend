import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export default function ProfileScreen() {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>프로필</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.name}>여행자</Text>
          <Text style={styles.email}>로그인 정보를 불러오는 중...</Text>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.border,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.bg.surfaceSoft,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 36,
  },
  name: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  email: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  signOutBtn: {
    paddingVertical: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.error,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.error,
  },
})
