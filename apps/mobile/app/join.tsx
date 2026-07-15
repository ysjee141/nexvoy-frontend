import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  acceptInvitationWithLegacyFallback,
  getInvitationSummaryWithLegacyFallback,
  type DocumentInvitationSummary,
  type LegacyTripInvitationSummary,
} from '@nexvoy/core/supabase/invitationRepository'
import type { DocumentKeyProvisioningStatusRecord } from '@nexvoy/core/sync/keyProvisioning'
import {
  DocumentKeyProvisioningStatusCard,
  type DocumentKeyProvisioningStatus,
} from '@/components/trip/DocumentKeyProvisioningStatusCard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
  ensureMobileDeviceKeyMaterial,
  loadOrRequestMobileProvisioningStatus,
} from '@/lib/local-first/keyProvisioningService'
import { restoreMobileEncryptedSnapshot } from '@/lib/local-first/mobileSnapshotRestoreService'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

type JoinInput = { token?: string; inviteCode?: string }

type JoinSummary =
  | {
      source: 'document'
      tripId: string
      destination: string | null
      startDate: string | null
      endDate: string | null
      ownerNickname: string | null
      role: 'editor' | 'viewer'
    }
  | {
      source: 'legacy'
      tripId: string
      destination: string
      startDate: string
      endDate: string
      ownerNickname: string | null
      role: 'editor'
    }

const INVALID_INVITE_COPY = '유효하지 않거나 만료된 초대입니다.'

export default function JoinScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ token?: string; code?: string }>()
  const { session, isLoading: authLoading } = useAuth()
  const token = singleParam(params.token)
  const code = singleParam(params.code)

  const [loading, setLoading] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [summary, setSummary] = useState<JoinSummary | null>(null)
  const [activeInput, setActiveInput] = useState<JoinInput | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [provisioningRequired, setProvisioningRequired] = useState(false)
  const [acceptedDocumentId, setAcceptedDocumentId] = useState<string | null>(null)
  const [provisioningStatus, setProvisioningStatus] = useState<DocumentKeyProvisioningStatusRecord | null>(null)
  const [statusChecking, setStatusChecking] = useState(false)
  const readinessInFlight = useRef(false)

  const resolveInvitation = async (input: JoinInput) => {
    setLoading(true)
    setMessage(null)
    setProvisioningRequired(false)
    setAcceptedDocumentId(null)
    setProvisioningStatus(null)
    try {
      const result = await getInvitationSummaryWithLegacyFallback(supabase, input)
      if (!result.summary) throw new Error(INVALID_INVITE_COPY)
      setSummary(normalizeSummary(result.source, result.summary))
      setActiveInput(input)
    } catch {
      setSummary(null)
      setActiveInput(null)
      setMessage(input.token ? '링크가 열리지 않으면 초대 코드를 입력해 주세요.' : INVALID_INVITE_COPY)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const input = token ? { token } : code ? { inviteCode: sanitizeInviteCode(code) } : null
    if (input) {
      void resolveInvitation(input)
    } else {
      setMessage('초대 코드를 입력해 주세요.')
    }
  }, [token, code])

  const handleCodeSubmit = () => {
    const inviteCode = sanitizeInviteCode(codeInput)
    if (!inviteCode) {
      setMessage('초대 코드를 입력해 주세요.')
      return
    }
    void resolveInvitation({ inviteCode })
  }

  const handleAccept = async () => {
    if (!activeInput || !summary || accepting) return
    if (!session) {
      router.push({ pathname: '/(auth)/login', params: { next: buildJoinPath(activeInput) } })
      return
    }

    setAccepting(true)
    setMessage(null)
    setProvisioningRequired(false)
    try {
      const result = await acceptInvitationWithLegacyFallback(supabase, activeInput)
      if (result.source === 'document') {
        const { deviceId } = await ensureMobileDeviceKeyMaterial(supabase)
        const status = await loadOrRequestMobileProvisioningStatus({
          supabase,
          documentId: result.result.documentId,
          deviceId,
        })
        if (!status.hasActiveKey && status.status !== 'completed') {
          setAcceptedDocumentId(result.result.documentId)
          setProvisioningStatus(status)
          setProvisioningRequired(true)
          return
        }
        const restore = await restoreMobileEncryptedSnapshot({
          supabase,
          documentId: result.result.documentId,
        })
        if (restore.status === 'restored') {
          router.replace({ pathname: '/trip/[id]', params: { id: result.result.documentId } })
          return
        }
        setAcceptedDocumentId(result.result.documentId)
        setProvisioningStatus(status)
        setProvisioningRequired(true)
        setMessage('참여는 완료됐습니다. 최신 여정 데이터를 준비하고 있어요.')
        return
      }
      router.replace({ pathname: '/trip/[id]', params: { id: result.tripId ?? summary.tripId } })
    } catch {
      setMessage('초대를 수락하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setAccepting(false)
    }
  }

  const handleProvisioningRetry = async () => {
    const documentId = acceptedDocumentId ?? (summary?.source === 'document' ? summary.tripId : null)
    if (!documentId || readinessInFlight.current) return

    readinessInFlight.current = true
    setStatusChecking(true)
    setMessage(null)
    try {
      const { deviceId } = await ensureMobileDeviceKeyMaterial(supabase)
      const status = await loadOrRequestMobileProvisioningStatus({
        supabase,
        documentId,
        deviceId,
      })
      setAcceptedDocumentId(documentId)
      setProvisioningStatus(status)
      setProvisioningRequired(!status.hasActiveKey && status.status !== 'completed')
      if (status.hasActiveKey || status.status === 'completed') {
        const restore = await restoreMobileEncryptedSnapshot({ supabase, documentId })
        if (restore.status === 'restored') {
          router.replace({ pathname: '/trip/[id]', params: { id: documentId } })
          return
        }
        setProvisioningRequired(true)
        setMessage('참여는 완료됐습니다. 최신 여정 데이터를 준비하고 있어요.')
      }
    } catch {
      setMessage('여정 데이터 준비 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      readinessInFlight.current = false
      setStatusChecking(false)
    }
  }

  useEffect(() => {
    if (!provisioningRequired || !acceptedDocumentId) return undefined
    const interval = setInterval(() => {
      void handleProvisioningRetry()
    }, 5000)
    return () => clearInterval(interval)
  // The retry handler intentionally reads the latest screen state on each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedDocumentId, provisioningRequired])

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              accessibilityRole="button"
              accessibilityLabel="홈으로"
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.brand.ink} />
            </Pressable>
            <Text style={styles.headerTitle}>여정 초대</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.heroIcon}>
              <Ionicons name="airplane-outline" size={28} color={colors.brand.primary} />
            </View>
            <Text style={styles.title}>
              {summary?.destination ? `${summary.destination} 여정에 초대받았어요` : '여정 초대 확인'}
            </Text>
            <Text style={styles.subtitle}>
              초대 링크 또는 코드를 확인하고 있어요.
            </Text>

            {loading || authLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.brand.primary} />
                <Text style={styles.loadingText}>초대 정보를 확인하고 있어요</Text>
              </View>
            ) : summary ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>{summary.destination ?? '공유된 여정'}</Text>
                <Text style={styles.summaryMeta}>
                  권한: {summary.role === 'editor' ? '편집자' : '뷰어'}
                </Text>
                {summary.startDate && summary.endDate ? (
                  <Text style={styles.summaryMeta}>기간: {summary.startDate} ~ {summary.endDate}</Text>
                ) : null}
                {summary.ownerNickname ? (
                  <Text style={styles.summaryMeta}>{summary.ownerNickname}님이 초대했습니다.</Text>
                ) : null}
              </View>
            ) : null}

            {provisioningRequired ? (
              <DocumentKeyProvisioningStatusCard
                status={toDisplayProvisioningStatus(provisioningStatus?.status ?? 'pending')}
                errorCode={provisioningStatus?.errorCode}
                primaryActionLabel={provisioningStatus?.hasActiveKey || provisioningStatus?.status === 'completed'
                  ? '여정 열기'
                  : '준비 상태 다시 확인'}
                primaryActionBusy={statusChecking}
                onPrimaryAction={handleProvisioningRetry}
                style={styles.provisioningCard}
                footer={
                  <Text style={styles.noticeText}>
                    이 기기 정보를 등록했습니다. 관리자 또는 편집자가 여정 데이터 준비를 완료하면 다시 시도할 수 있어요.
                  </Text>
                }
              />
            ) : null}

            {message ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            ) : null}

            {summary ? (
              <Pressable
                onPress={provisioningRequired ? handleProvisioningRetry : handleAccept}
                disabled={accepting || loading || statusChecking}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  (accepting || loading || statusChecking) && styles.buttonDisabled,
                  pressed && !accepting && !loading && !statusChecking && styles.pressedSoft,
                ]}
              >
                {accepting || statusChecking ? (
                  <ActivityIndicator color={colors.bg.canvas} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {session ? (provisioningRequired ? '다시 시도' : '여정에 참여하기') : '로그인 후 참여하기'}
                  </Text>
                )}
              </Pressable>
            ) : null}

            <View style={styles.codePanel}>
              <Text style={styles.codeLabel}>초대 코드 입력</Text>
              <TextInput
                value={codeInput}
                onChangeText={(value) => setCodeInput(formatInviteCode(value))}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="A7K9-P2Q4-X8"
                placeholderTextColor={colors.brand.mutedSoft}
                style={styles.codeInput}
              />
              <Pressable
                onPress={handleCodeSubmit}
                disabled={loading || !codeInput.trim()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (loading || !codeInput.trim()) && styles.buttonDisabled,
                  pressed && !loading && codeInput.trim().length > 0 && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>초대 확인</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function normalizeSummary(
  source: 'document' | 'legacy',
  value: DocumentInvitationSummary | LegacyTripInvitationSummary,
): JoinSummary {
  if (source === 'document') {
    const summary = value as DocumentInvitationSummary
    return {
      source,
      tripId: summary.documentId,
      destination: summary.destination,
      startDate: summary.startDate,
      endDate: summary.endDate,
      ownerNickname: summary.ownerNickname,
      role: summary.role,
    }
  }

  const summary = value as LegacyTripInvitationSummary
  return {
    source,
    tripId: summary.trip_id,
    destination: summary.destination,
    startDate: summary.start_date,
    endDate: summary.end_date,
    ownerNickname: summary.owner_nickname,
    role: 'editor',
  }
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function buildJoinPath(input: JoinInput): string {
  if (input.token) return `/join?token=${encodeURIComponent(input.token)}`
  if (input.inviteCode) return `/join?code=${encodeURIComponent(input.inviteCode)}`
  return '/join'
}

function sanitizeInviteCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function formatInviteCode(value: string): string {
  return sanitizeInviteCode(value).replace(/(.{4})(?=.)/g, '$1-')
}

function toDisplayProvisioningStatus(status: DocumentKeyProvisioningStatusRecord['status']): DocumentKeyProvisioningStatus {
  if (
    status === 'waiting_for_material'
    || status === 'pending'
    || status === 'processing'
    || status === 'failed'
    || status === 'completed'
  ) {
    return status
  }
  return status === 'none' ? 'pending' : 'failed'
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  card: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.brand.ink,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.brand.muted,
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  loadingBox: {
    marginTop: spacing.xl,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.bg.surfaceSoft,
  },
  loadingText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  summaryBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  summaryTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    marginBottom: spacing.sm,
  },
  summaryMeta: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 21,
  },
  noticeBox: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bg.surfaceSoft,
  },
  provisioningCard: {
    marginTop: spacing.base,
  },
  noticeTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    marginBottom: spacing.xs,
  },
  noticeText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  messageBox: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
  },
  messageText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    marginTop: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  primaryButtonText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  codePanel: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  codeLabel: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  codeInput: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    color: colors.brand.ink,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textAlign: 'center',
    backgroundColor: colors.bg.canvas,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  secondaryButtonText: {
    color: colors.brand.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.72,
  },
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
})
