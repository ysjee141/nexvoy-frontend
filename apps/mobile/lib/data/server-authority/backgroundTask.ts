import { Platform } from 'react-native'
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import {
  defineMobileBackgroundWorker,
  isMobileBackgroundWorkPaused,
  runExclusiveMobileBackgroundWork,
} from '@/lib/backgroundTaskCoordinator'
import { supabase } from '@/lib/supabase'
import { flushMobileAuthorityAccount } from './syncService'

export const MOBILE_AUTHORITY_BACKGROUND_TASK_NAME = 'onvoy.mobile.authority.background'

const authorityWorker = defineMobileBackgroundWorker({
  name: MOBILE_AUTHORITY_BACKGROUND_TASK_NAME,
  minimumInterval: 15,
  run: async () => {
    if (isMobileBackgroundWorkPaused()) return
    const { data } = await supabase.auth.getSession()
    const accountId = data.session?.user.id
    if (!accountId) return
    await runExclusiveMobileBackgroundWork(
      MOBILE_AUTHORITY_BACKGROUND_TASK_NAME,
      () => flushMobileAuthorityAccount(accountId),
      () => null,
    )
  },
})

if (!TaskManager.isTaskDefined(MOBILE_AUTHORITY_BACKGROUND_TASK_NAME)) {
  TaskManager.defineTask(MOBILE_AUTHORITY_BACKGROUND_TASK_NAME, async ({ error }) => {
    if (!error) {
      try {
        await authorityWorker.run()
      } catch {
        // Background execution is best effort; foreground recovery remains authoritative.
      }
    }
    return BackgroundTask.BackgroundTaskResult.Success
  })
}

export async function registerMobileAuthorityBackgroundTask(): Promise<boolean> {
  if (!isSupportedNativePlatform()) return false
  try {
    if (!await TaskManager.isAvailableAsync()) return false
    if (await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) {
      return false
    }
    if (await TaskManager.isTaskRegisteredAsync(MOBILE_AUTHORITY_BACKGROUND_TASK_NAME)) {
      return true
    }
    await BackgroundTask.registerTaskAsync(MOBILE_AUTHORITY_BACKGROUND_TASK_NAME, {
      minimumInterval: authorityWorker.minimumInterval,
    })
    return true
  } catch {
    return false
  }
}

export async function unregisterMobileAuthorityBackgroundTask(): Promise<boolean> {
  if (!isSupportedNativePlatform()) return false
  try {
    if (!await TaskManager.isTaskRegisteredAsync(MOBILE_AUTHORITY_BACKGROUND_TASK_NAME)) {
      return true
    }
    await BackgroundTask.unregisterTaskAsync(MOBILE_AUTHORITY_BACKGROUND_TASK_NAME)
    return true
  } catch {
    return false
  }
}

function isSupportedNativePlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios'
}
