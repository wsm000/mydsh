/**
 * Mount this plugin into a DSH profile (workspace-side installer).
 *
 * Usage: node tools/install-into-profile.mjs <profileDir> <packageName> <pluginDir>
 *
 * Idempotently:
 *   1. adds `"<packageName>": "link:<pluginDir>"` to the profile's dependencies,
 *   2. appends one `- insert:` mount row to the profile's cordis.patch.yml (the
 *      user layer DSH applies after every bundle layer — the path used by the
 *      other out-of-tree plugins here, and one a running host can pick up
 *      without a full restart),
 * and backs up both files before writing.
 *
 * After this, the profile still needs its package manager to materialize the
 * link (`node <pnpm.mjs> install` in <profileDir>), and the host needs to load
 * the composition (restart, or a config reload).
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [profileDir, packageName, pluginDir] = process.argv.slice(2)
if (!profileDir || !packageName || !pluginDir) {
  console.error('usage: node tools/install-into-profile.mjs <profileDir> <packageName> <pluginDir>')
  process.exit(2)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const linkSpec = `link:${pluginDir.replace(/\\/g, '/')}`

// 1. dependency
const packagePath = join(profileDir, 'package.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
if (pkg.dependencies?.[packageName] === linkSpec) {
  console.log(`dependency already present: ${packageName}`)
} else {
  pkg.dependencies = { ...(pkg.dependencies ?? {}), [packageName]: linkSpec }
  copyFileSync(packagePath, `${packagePath}.bak-${packageName}-${stamp}`)
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  console.log(`dependency added: ${packageName} -> ${linkSpec}`)
}

// 2. user-layer mount row
const patchPath = join(profileDir, 'cordis.patch.yml')
const patch = readFileSync(patchPath, 'utf8')
if (new RegExp(`^\\s*-?\\s*id:\\s*${packageName}\\s*$`, 'm').test(patch)) {
  console.log(`mount row already present: ${packageName}`)
} else {
  copyFileSync(patchPath, `${patchPath}.bak-${packageName}-${stamp}`)
  const block = [
    '',
    `# ${packageName}（插件本体：${pluginDir}）`,
    '- insert:',
    `    - id: ${packageName}`,
    `      name: ${packageName}`,
    '',
  ].join('\n')
  writeFileSync(patchPath, patch.endsWith('\n') ? `${patch}${block}` : `${patch}\n${block}`, 'utf8')
  console.log(`mount row appended: ${packageName} -> ${patchPath}`)
}

console.log('\nnext steps:')
console.log(`  cd ${profileDir} && node <dsh pnpm.mjs> install`)
console.log('  then let the host reload the profile (restart, or touch cordis.patch.yml on a watcher host)')
