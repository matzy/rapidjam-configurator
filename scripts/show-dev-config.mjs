import { resolveDevConfig, formatDevConfig } from './dev-config.mjs'

const config = resolveDevConfig()
console.log(formatDevConfig(config))
const hasProcessOverrides = ['RAPIDJAM_DEV_PORT', 'RAPIDJAM_SERVE_PORT', 'RAPIDJAM_PREVIEW_PORT', 'RAPIDJAM_DEV_PROFILE']
	.some((key) => process.env[key] !== undefined)
console.log(`Config source: ${hasProcessOverrides ? 'process environment overrides plus .env.local/defaults' : '.env.local or built-in defaults'}`)
