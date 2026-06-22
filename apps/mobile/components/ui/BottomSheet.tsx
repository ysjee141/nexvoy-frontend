import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '@/theme'

interface BottomSheetProps {
  visible: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  contentStyle?: StyleProp<ViewStyle>
}

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  contentStyle,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
          <View style={styles.handle} />
          {(title || onClose) ? (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {title ?? ''}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="닫기"
                hitSlop={8}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={20} color={colors.brand.ink} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.bg.canvas,
    ...shadows.modal,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginTop: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.brand.hairline,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.brand.ink,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.bg.surfaceSoft,
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
})
