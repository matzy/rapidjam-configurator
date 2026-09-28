export interface DevConfig {
  devPort: number
  servePort: number
  previewPort: number
  profile: string
}

export function resolveDevConfig(options?: {
  root?: string
  env?: Record<string, string | undefined>
}): DevConfig

export function formatDevConfig(config: DevConfig): string
