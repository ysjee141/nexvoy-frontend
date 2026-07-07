import { Platform } from 'react-native'
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { defineMobileBackgroundWorker } from '@/lib/backgroundTaskCoordinator'
import { logLocalFirstEvent } from '@/lib/observability'
import { supabase } from '@/lib/supabase'
import { runMobileBackgroundKeyProvisioning } from './keyProvisioningService'

export const MOBILE_PROVISIONING_BACKGROUND_TASK_NAME = 'onvoy.mobile.provisioning.background'

const provisioningWorker = defineMobileBackgroundWorker({
  name: MOBILE_PROVISIONING_BACKGROUND_TASK_NAME,
  minimumInterval: 15,
  run: async () => {
    await runMobileBackgroundKeyProvisioning({
      supabase,
      limit: 5,
    })
  },
})

if (!TaskManager.isTaskDefined(MOBILE_PROVISIONING_BACKGROUND_TASK_NAME)) {
  TaskManager.defineTask(MOBILE_PROVISIONING_BACKGROUND_TASK_NAME, async ({ error }) => {
    if (error) {
      await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_task_error')
      return BackgroundTask.BackgroundTaskResult.Success
    }

    try {
      await provisioningWorker.run()
    } catch {
      await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_interrupted')
    }

    return BackgroundTask.BackgroundTaskResult.Success
  })
}

export async function registerMobileProvisioningBackgroundTask(): Promise<boolean> {
  if (!isSupportedNativePlatform()) return false

  try {
    const taskManagerAvailable = await TaskManager.isAvailableAsync()
    if (!taskManagerAvailable) {
      await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_unavailable')
      return false
    }

    const status = await BackgroundTask.getStatusAsync()
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_restricted')
      return false
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(MOBILE_PROVISIONING_BACKGROUND_TASK_NAME)
    if (alreadyRegistered) return true

    await BackgroundTask.registerTaskAsync(MOBILE_PROVISIONING_BACKGROUND_TASK_NAME, {
      minimumInterval: provisioningWorker.minimumInterval,
    })
    await emitBackgroundProvisioningRegistrationEvent('pending', 'background_registered')
    return true
  } catch {
    await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_registration_failed')
    return false
  }
}

export async function unregisterMobileProvisioningBackgroundTask(): Promise<boolean> {
  if (!isSupportedNativePlatform()) return false

  try {
    const registered = await TaskManager.isTaskRegisteredAsync(MOBILE_PROVISIONING_BACKGROUND_TASK_NAME)
    if (!registered) return true
    await BackgroundTask.unregisterTaskAsync(MOBILE_PROVISIONING_BACKGROUND_TASK_NAME)
    await emitBackgroundProvisioningRegistrationEvent('completed', 'background_unregistered')
    return true
  } catch {
    await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_unregistration_failed')
    return false
  }
}

export async function triggerMobileProvisioningBackgroundTaskForTesting(): Promise<boolean> {
  if (!__DEV__) return false

  try {
    return await BackgroundTask.triggerTaskWorkerForTestingAsync()
  } catch {
    await emitBackgroundProvisioningRegistrationEvent('skipped', 'background_test_trigger_failed')
    return false
  }
}

function isSupportedNativePlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios'
}

async function emitBackgroundProvisioningRegistrationEvent(
  status: 'pending' | 'completed' | 'skipped',
  reasonCode: string,
): Promise<void> {
  await logLocalFirstEvent('document_key_provisioning_pending', {
    document_type: 'trip',
    entity_type: 'member',
    operation: 'updated',
    status,
    reason_code: reasonCode,
  })
}
