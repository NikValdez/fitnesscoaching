import { build } from 'esbuild'
import { chmodSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { parse } from 'dotenv'

if (process.platform !== 'darwin') throw new Error('This installer requires macOS.')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const support = join(homedir(), 'Library', 'Application Support', 'Steve Rossiter Analytics')
const agents = join(homedir(), 'Library', 'LaunchAgents')
const label = 'com.steverossiter.instagram-daily'
const plistPath = join(agents, `${label}.plist`)
const bundle = join(support, 'instagram-collector.mjs')
const target = `gui/${process.getuid()}`
const prodPath = join(root, '.env.cloudflare.json')
const env = existsSync(prodPath)
  ? JSON.parse(readFileSync(prodPath, 'utf8'))
  : { ...parse(readFileSync(join(root, '.env'))), ...process.env }
if (!env.DATABASE_URL) throw new Error('No production database connection was found.')
if (new URL(env.DATABASE_URL).protocol !== 'postgresql:')
  throw new Error('A PostgreSQL connection is required.')

mkdirSync(support, { recursive: true, mode: 0o700 })
chmodSync(support, 0o700)
mkdirSync(agents, { recursive: true })
// Bundle the runtime outside Desktop so launchd doesn't need Desktop access or
// depend on a terminal, the source checkout, or the application being open.
await build({
  entryPoints: [join(root, 'scripts/mac-instagram.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  plugins: [
    {
      name: 'node-database',
      setup(builder) {
        // The web app's default client is generated for Workers. The installed
        // collector uses the equivalent Node client, including for default DBs.
        builder.onResolve({ filter: /\/db\.server$/ }, () => ({
          path: join(root, 'scripts/db.ts'),
        }))
      },
    },
  ],
  logLevel: 'warning',
})
chmodSync(bundle, 0o600)
writeFileSync(join(support, '.env'), `DATABASE_URL=${JSON.stringify(env.DATABASE_URL)}\n`, {
  mode: 0o600,
})
chmodSync(join(support, '.env'), 0o600)
const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
writeFileSync(
  plistPath,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(bundle)}</string></array>
  <key>WorkingDirectory</key><string>${xml(support)}</string>
  <key>RunAtLoad</key><true/>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StartInterval</key><integer>3600</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(join(support, 'collector.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(support, 'collector.log'))}</string>
</dict></plist>\n`,
  { mode: 0o600 },
)
execFileSync('/usr/bin/plutil', ['-lint', plistPath], { stdio: 'inherit' })
console.log(`Installed private collector runtime at ${support}`)
if (!process.argv.includes('--prepare')) {
  // Configure after the Worker release that excludes Mac items is deployed.
  execFileSync(process.execPath, [bundle, '--configure'], { cwd: support, stdio: 'inherit' })
  const loaded = spawnSync('/bin/launchctl', ['print', `${target}/${label}`], { stdio: 'ignore' })
  if (loaded.status === 0) execFileSync('/bin/launchctl', ['bootout', `${target}/${label}`])
  execFileSync('/bin/launchctl', ['enable', `${target}/${label}`])
  execFileSync('/bin/launchctl', ['bootstrap', target, plistPath])
  console.log(
    'Daily Instagram collection is loaded. Runs at 9 a.m. local time and checks hourly for missed/failed runs.',
  )
}
