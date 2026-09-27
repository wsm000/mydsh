import { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context) {
  // 注册插件
  ctx.on('ready', () => {
    console.log('dsh-model-selector-3tier loaded')
  })
}

export const name = 'dsh-model-selector-3tier'
