import type { DeviceTransport } from '../device'
import { HttpTransport, MockTransport } from '../device'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function createTransport(search = window.location.search): DeviceTransport {
  if (isTauriRuntime()) return new HttpTransport('', true)
  return new URLSearchParams(search).get('transport') === 'http'
    ? new HttpTransport('/rapidjam-api')
    : new MockTransport()
}
