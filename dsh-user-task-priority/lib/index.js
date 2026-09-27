import { randomUUID } from 'node:crypto'

/**
 * Put claimed real-user messages after host and plugin context for each step.
 * The real user message objects are returned unchanged so source metadata and
 * content blocks (including files and images) remain intact. A small
 * continuation guard is injected only after an actual max-token truncation.
 */
export const name = 'dsh-user-task-priority'

export const CONTINUATION_GUARD_TEXT = 'Continuation guard: the previous assistant response ended at the output-token limit. Treat the user\'s short continuation request as "continue the truncated answer." Continue from the truncation point only; do not restart, recap, repeat earlier reasoning/planning, or emit new planning. Output only the remaining final answer or next actionable content, concisely.'

const CONTINUATION_PHRASES = new Set([
  'continue',
  'cont',
  'go on',
  'keep going',
  'carry on',
  'resume',
  'next',
  'more',
  '继续',
  '继续吧',
  '接着',
  '接着说',
  '往下',
  '下一步',
  '下一个',
  '再继续',
])

function isRealUserMessage(message) {
  return message?.source?.kind === 'user'
}

function textOnly(message) {
  if (!Array.isArray(message?.content) || message.content.length === 0) return undefined

  let text = ''
  for (const block of message.content) {
    if (block?.type !== 'text' || typeof block.text !== 'string') return undefined
    text += block.text
  }
  return text
}

function normalizeContinuationText(text) {
  return text
    .trim()
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
    .replace(/[.。!！?？…]+$/g, '')
    .trim()
    .toLowerCase()
}

export function isContinuationPrompt(text) {
  if (typeof text !== 'string') return false
  return CONTINUATION_PHRASES.has(normalizeContinuationText(text))
}

export function previousTurnEndedMaxTokens(events, currentTurn) {
  if (!Array.isArray(events)) return false

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'turn/end') continue
    const turn = event.data?.turn
    if (typeof currentTurn === 'number' && typeof turn === 'number' && turn >= currentTurn) continue
    return event.data?.reason?.kind === 'max-tokens'
  }

  return false
}

export function isSimpleContinuationBatch(messages) {
  if (!Array.isArray(messages)) return false

  const userTasks = messages.filter(isRealUserMessage)
  if (userTasks.length === 0) return false

  return userTasks.every((message) => isContinuationPrompt(textOnly(message)))
}

export function shouldAddContinuationGuard(messages, events, currentTurn) {
  return previousTurnEndedMaxTokens(events, currentTurn) && isSimpleContinuationBatch(messages)
}

export function createContinuationGuardMessage() {
  return {
    id: `dsh-continuation-guard-${randomUUID()}`,
    role: 'user',
    source: { kind: 'plugin', plugin: name, form: 'max-tokens-continuation' },
    content: [{ type: 'text', text: CONTINUATION_GUARD_TEXT }],
  }
}

export function addContinuationGuard(messages) {
  if (!Array.isArray(messages)) return messages

  const firstUserTask = messages.findIndex(isRealUserMessage)
  if (firstUserTask < 0) return messages

  return [
    ...messages.slice(0, firstUserTask),
    createContinuationGuardMessage(),
    ...messages.slice(firstUserTask),
  ]
}

export function prioritizeUserMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return messages

  const context = []
  const userTasks = []
  let sawUserTask = false
  let needsReorder = false
  for (const message of messages) {
    if (message?.source?.kind === 'user') {
      sawUserTask = true
      userTasks.push(message)
    } else {
      if (sawUserTask) needsReorder = true
      context.push(message)
    }
  }

  if (!sawUserTask || context.length === 0 || !needsReorder) return messages
  return [...context, ...userTasks]
}

export function prepareStepMessages(messages, options = {}) {
  const prioritized = prioritizeUserMessages(messages)
  if (!shouldAddContinuationGuard(prioritized, options.events, options.turn)) return prioritized
  return addContinuationGuard(prioritized)
}

export function apply(ctx) {
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision

    const messages = prepareStepMessages(decision.messages, {
      events: payload?.agent?.session?.snapshotEvents?.(),
      turn: payload?.turn,
    })
    return messages === decision.messages ? decision : { ...decision, messages }
  }, { prepend: true })
}
