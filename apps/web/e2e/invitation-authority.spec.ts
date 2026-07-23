import { test, expect } from './fixtures/auth'
import {
  cleanupTripsByUser,
  createAuthorityInvitation,
  getAuthorityDocumentMember,
  seedAuthorityTrip,
} from './helpers/seed'

test.describe('TASK-058 invitation authority', () => {
  test('NEW-A01 targeted invitation rejects mismatched account and the invited account accepts from pending UI', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 이메일 초대',
    })
    const invitation = await createAuthorityInvitation(multiUsers.owner, trip.id, {
      role: 'editor',
      targetEmail: multiUsers.editor.email,
    })

    try {
      const mismatchContext = await createAuthenticatedContextFor(multiUsers.inviteMismatch)
      const mismatchPage = await mismatchContext.newPage()
      await mismatchPage.goto(`/join?token=${encodeURIComponent(invitation.token)}`)
      await expect(mismatchPage.getByRole('button', { name: '여정에 참여하기' })).toBeVisible()
      await mismatchPage.getByRole('button', { name: '여정에 참여하기' }).click()
      await expect(mismatchPage.getByText(/다른 계정으로 발송되었습니다/)).toBeVisible()
      expect(await getAuthorityDocumentMember(trip.id, multiUsers.inviteMismatch.id)).toBeNull()

      const editorContext = await createAuthenticatedContextFor(multiUsers.editor)
      const editorPage = await editorContext.newPage()
      await editorPage.goto('/')
      await expect(editorPage.getByRole('region', { name: '여행 초대' })).toBeVisible({
        timeout: 15000,
      })
      await expect(editorPage.getByText('새로운 여행 초대 1건')).toBeVisible()
      await editorPage.getByRole('button', { name: '초대 수락' }).click()
      await expect(editorPage).toHaveURL(new RegExp(`/trips/detail\\?id=${trip.id}`), {
        timeout: 15000,
      })
      await expect(editorPage.getByRole('heading', {
        name: 'TASK-058 이메일 초대 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })
      await expect.poll(
        () => getAuthorityDocumentMember(trip.id, multiUsers.editor.id),
        { timeout: 10000 },
      ).toMatchObject({ role: 'editor', status: 'accepted' })
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id)
    }
  })

  test('NEW-A02 link and code invitations enforce expiry and max use', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 링크 코드 초대',
    })

    try {
      const linkInvitation = await createAuthorityInvitation(multiUsers.owner, trip.id, {
        role: 'editor',
        maxUses: 1,
      })
      const outsiderContext = await createAuthenticatedContextFor(multiUsers.outsider)
      const outsiderPage = await outsiderContext.newPage()
      await outsiderPage.goto(`/join?token=${encodeURIComponent(linkInvitation.token)}`)
      await expect(outsiderPage.getByRole('button', { name: '여정에 참여하기' })).toBeVisible()
      await outsiderPage.getByRole('button', { name: '여정에 참여하기' }).click()
      await expect(outsiderPage.getByRole('heading', {
        name: 'TASK-058 링크 코드 초대 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })

      const reusedContext = await createAuthenticatedContextFor(multiUsers.inviteMismatch)
      const reusedPage = await reusedContext.newPage()
      await reusedPage.goto(`/join?token=${encodeURIComponent(linkInvitation.token)}`)
      await expect(reusedPage.getByRole('heading', { name: '초대를 확인할 수 없어요' })).toBeVisible()
      expect(await getAuthorityDocumentMember(trip.id, multiUsers.inviteMismatch.id)).toBeNull()

      const codeInvitation = await createAuthorityInvitation(multiUsers.owner, trip.id, {
        role: 'viewer',
        maxUses: 1,
      })
      const viewerContext = await createAuthenticatedContextFor(multiUsers.viewer)
      const viewerPage = await viewerContext.newPage()
      await viewerPage.goto('/join')
      await viewerPage.getByLabel('초대 코드').fill(codeInvitation.inviteCode)
      await viewerPage.getByRole('button', { name: '초대 확인' }).click()
      await expect(viewerPage.getByText('권한: 뷰어')).toBeVisible()
      await viewerPage.getByRole('button', { name: '여정에 참여하기' }).click()
      await expect(viewerPage.getByRole('heading', {
        name: 'TASK-058 링크 코드 초대 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })
      await expect.poll(
        () => getAuthorityDocumentMember(trip.id, multiUsers.viewer.id),
        { timeout: 10000 },
      ).toMatchObject({ role: 'viewer', status: 'accepted' })

      const expiredInvitation = await createAuthorityInvitation(multiUsers.owner, trip.id, {
        expiresAt: '2020-01-01T00:00:00.000Z',
      })
      await reusedPage.goto(`/join?token=${encodeURIComponent(expiredInvitation.token)}`)
      await expect(reusedPage.getByRole('heading', { name: '초대를 확인할 수 없어요' })).toBeVisible()
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id)
    }
  })
})
