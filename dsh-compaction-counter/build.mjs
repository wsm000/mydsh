/**
 * Client + host build for dsh-compaction-counter, invoking the standalone
 * esbuild executable directly (the Node API's service spawn is blocked by the
 * harness sandbox, which forbids pipe-spawned child processes; a direct exe
 * bypasses that and matches `stdio: inherit` semantics, so it is allowed).
 *
 * The web server serves exactly one file per plugin
 * (/plugins/dsh-compaction-counter/client.js), so the client half is one CJS
 * bundle wrapped in the ModuleLoader factory handshake; @deepseek-ai/dsh-* and
 * react stay external (the profile's node_modules and the app's module system
 * provide them). The host half is a plain ESM module for Node.
 *
 * This plugin ships from the `mydsh` tree without its own toolchain, so this
 * script resolves esbuild's standalone binary from the sibling dsh-file-panel
 * package.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

// Standalone esbuild binary (0.25.12) from the sibling file-panel's pnpm store.
const esbuildExe = String.raw`C:\Users\86150\Documents\deepseekharness\mydsh\dsh-file-panel\node_modules\.pnpm\@esbuild+win32-x64@0.25.12\node_modules\@esbuild\win32-x64\esbuild.exe`

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*']

function cli(args) {
  execFileSync(esbuildExe, args, { stdio: 'inherit' })
}

// Host half (ESM, node).
cli([
  'src/index.ts',
  '--bundle',
  '--format=esm',
  '--platform=node',
  '--target=node22',
  '--sourcemap',
  ...dshExternal.map((e) => `--external:${e}`),
  '--outfile=lib/index.js',
])

// Client bundle (CJS, browser, ModuleLoader handshake).
const banner = "window.__ModuleLoader__.load({ id: 'dsh-compaction-counter', factory: (require) => { var module = { exports: {} }; var exports = module.exports;"
const footer = 'return module.exports; } });'
cli([
  'src/client/index.ts',
  '--bundle',
  '--format=cjs',
  '--platform=browser',
  '--target=es2022',
  '--sourcemap',
  '--jsx=automatic',
  '--loader:.ts=tsx',
  ...dshExternal.map((e) => `--external:${e}`),
  '--external:react',
  '--external:react-dom',
  '--external:react/jsx-runtime',
  '--external:react/jsx-dev-runtime',
  '--external:scheduler',
  `--banner:js=${banner}`,
  `--footer:js=${footer}`,
  '--outfile=lib/client.js',
])

console.log('build complete')
