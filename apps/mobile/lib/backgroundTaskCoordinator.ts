export interface MobileBackgroundWorkerDefinition {
  name: string
  minimumInterval: number
  run: () => Promise<void>
}

const workerRegistry = new Map<string, MobileBackgroundWorkerDefinition>()
const activeWorkers = new Set<string>()
let mobileBackgroundWorkPaused = false

export function defineMobileBackgroundWorker<T extends MobileBackgroundWorkerDefinition>(definition: T): T {
  workerRegistry.set(definition.name, definition)
  return definition
}

export function getMobileBackgroundWorkerDefinition(name: string): MobileBackgroundWorkerDefinition | null {
  return workerRegistry.get(name) ?? null
}

export function setMobileBackgroundWorkPaused(paused: boolean): void {
  mobileBackgroundWorkPaused = paused
}

export function isMobileBackgroundWorkPaused(): boolean {
  return mobileBackgroundWorkPaused
}

export async function runExclusiveMobileBackgroundWork<T>(
  workerName: string,
  run: () => Promise<T>,
  onAlreadyRunning: () => T | Promise<T>,
): Promise<T> {
  if (activeWorkers.has(workerName)) {
    return onAlreadyRunning()
  }

  activeWorkers.add(workerName)
  try {
    return await run()
  } finally {
    activeWorkers.delete(workerName)
  }
}
