// Global in-memory simulation state
// In dev: shared across hot reloads via globalThis
declare global {
  var __simState: Record<string, SimEvent> | undefined
}

export interface SimEvent {
  active: boolean
  type: 'landslide' | 'none'
  stationId: string
  startedAt: number
  durationMs: number
  intensity: number // 1-3: 1=minor, 2=moderate, 3=major
}

export function getSimState(): Record<string, SimEvent> {
  if (!globalThis.__simState) globalThis.__simState = {}
  return globalThis.__simState
}

export function setSimEvent(stationId: string, event: SimEvent) {
  if (!globalThis.__simState) globalThis.__simState = {}
  globalThis.__simState[stationId] = event
}

export function clearSimEvent(stationId: string) {
  if (globalThis.__simState) delete globalThis.__simState[stationId]
}

export function getActiveEvent(stationId: string): SimEvent | null {
  const state = getSimState()
  const ev = state[stationId]
  if (!ev || !ev.active) return null
  // Auto-expire after duration
  if (Date.now() - ev.startedAt > ev.durationMs) {
    clearSimEvent(stationId)
    return null
  }
  return ev
}