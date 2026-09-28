import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const readJson = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'))
const packageJson = readJson('package.json')
const packageLock = readJson('package-lock.json')
const tauriConfig = readJson('src-tauri/tauri.conf.json')
const cargoToml = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8')
const cargoLock = readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8').replace(/\r\n/g, '\n')

const errors = []
const version = packageJson.version
const lockRoot = packageLock.packages?.['']
const cargoTomlVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
const cargoPackageBlock = cargoLock.match(/\[\[package\]\]\n(?:(?!\n\[\[package\]\]).)*?name = "rapidjam-configurator"(?:(?!\n\[\[package\]\]).)*/s)?.[0]
const cargoLockVersion = cargoPackageBlock?.match(/^version = "([^"]+)"/m)?.[1]

for (const [source, value] of Object.entries({
  'package-lock.json': packageLock.version,
  'package-lock.json root package': lockRoot?.version,
  'tauri.conf.json': tauriConfig.version,
  'Cargo.toml': cargoTomlVersion,
  'Cargo.lock': cargoLockVersion,
})) {
  if (value !== version) errors.push(`${source}: expected ${version}, found ${value ?? 'missing'}`)
}

for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  const declared = packageJson[section] ?? {}
  const locked = lockRoot?.[section] ?? {}
  for (const [name, range] of Object.entries(declared)) {
    if (locked[name] !== range) errors.push(`${section}.${name}: lockfile has ${locked[name] ?? 'no entry'}, package.json has ${range}`)
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(range)) {
      errors.push(`${section}.${name}: release dependency must be an exact version, found ${range}`)
    }
  }
}

if (errors.length) {
  console.error('Release metadata check failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  console.log(`Release metadata is consistent: ${packageJson.name} ${version}`)
}
