import type { DeviceTransport } from '../device'
import { HttpTransport, MockTransport } from '../device'

export function createTransport(search = window.location.search): DeviceTransport {
  return new URLSearchParams(search).get('transport') === 'http'
    ? new HttpTransport('/rapidjam-api')
    : new MockTransport()
}
