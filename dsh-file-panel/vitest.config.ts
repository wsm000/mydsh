import ts from 'typescript'
import { defineConfig } from 'vitest/config'

/**
 * The compiled @deepseek-ai/dsh-* packages installed with the npm global
 * harness package: type-checking and host-runtime imports resolve here (the
 * plugin bundle keeps them external; the harness process provides them).
 */
const dshdeps = 'C:/Users/86150/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/'

const decoratorSyntax = /@(?:Remote|RemoteScope)\b/

/**
 * Pre-transform standard (stage-3) decorators with the TypeScript compiler:
 * vitest's esbuild pipeline does not accept the `@Remote` decorators the host
 * runtime uses, so decorator-bearing modules pass through `ts.transpileModule`
 * first — the same approach the harness's shared vitest config takes.
 */
function standardDecoratorPlugin() {
  return {
    name: 'dsh-file-panel-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText
          .replace(
            /^(\s*)(__esDecorate\()/gmu,
            '$1/* v8 ignore next -- compiler-synthetic decorator accessors have no source behavior */ $2',
          )
          .replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: {
    alias: {
      '@deepseek-ai': dshdeps,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      exclude: [
        // Pure type declarations: no runtime code exists to cover.
        'src/types.ts',
      ],
    },
  },
})
