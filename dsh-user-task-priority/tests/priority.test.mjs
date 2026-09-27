import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTINUATION_GUARD_TEXT,
  isContinuationPrompt,
  prepareStepMessages,
  previousTurnEndedMaxTokens,
  prioritizeUserMessages,
  shouldAddContinuationGuard,
} from '../lib/index.js'

const user = (text, extra = {}) => ({
  role: 'user',
  content: [{ type: 'text', text }],
  source: { kind: 'user', ...extra },
})

const injected = (text, kind = 'agent-instructions') => ({
  role: 'user',
  content: [{ type: 'text', text }],
  source: { kind },
})

const turnEnd = (turn, kind) => ({
  type: 'turn/end',
  data: { turn, reason: { kind } },
})

test('moves a real user task after injected context', () => {
  const task = user('请回答我的问题')
  const guide = injected('工作区指令')
  const result = prioritizeUserMessages([task, guide])

  assert.deepEqual(result, [guide, task])
  assert.strictEqual(result[1], task)
})

test('preserves the relative order of multiple user tasks', () => {
  const first = user('第一条')
  const second = user('第二条')
  const guide = injected('注入内容')

  assert.deepEqual(prioritizeUserMessages([first, guide, second]), [guide, first, second])
})

test('leaves already ordered and context-free messages unchanged', () => {
  const guide = injected('注入内容')
  const task = user('任务')

  const ordered = [guide, task]
  const single = [task]
  assert.strictEqual(prioritizeUserMessages(ordered), ordered)
  assert.strictEqual(prioritizeUserMessages(single), single)
})

test('does not reorder when there is no real user task', () => {
  const guide = injected('注入内容')
  const other = injected('其他内容', 'workspace')
  const messages = [guide, other]

  assert.strictEqual(prioritizeUserMessages(messages), messages)
})

test('keeps attachment and image blocks on the original message object', () => {
  const task = user('看这些文件')
  task.content.push({ type: 'image', source: { type: 'url', url: 'https://example.invalid/image.png' } })
  task.attachments = [{ path: 'notes.txt' }]
  const guide = injected('运行时上下文')

  const result = prioritizeUserMessages([task, guide])
  assert.strictEqual(result[1], task)
  assert.strictEqual(result[1].content[1].type, 'image')
  assert.deepEqual(result[1].attachments, [{ path: 'notes.txt' }])
})

test('recognizes concise continuation prompts only', () => {
  assert.equal(isContinuationPrompt('继续'), true)
  assert.equal(isContinuationPrompt(' Continue. '), true)
  assert.equal(isContinuationPrompt('next'), true)
  assert.equal(isContinuationPrompt('continue with chapter 110'), false)
  assert.equal(isContinuationPrompt('please inspect the next file'), false)
})

test('detects a previous max-token turn before the current turn', () => {
  const events = [turnEnd(1, 'completed'), turnEnd(2, 'max-tokens')]

  assert.equal(previousTurnEndedMaxTokens(events, 3), true)
  assert.equal(previousTurnEndedMaxTokens(events, 2), false)
  assert.equal(previousTurnEndedMaxTokens([turnEnd(1, 'completed')], 2), false)
})

test('injects a continuation guard after context and before continuation user tasks', () => {
  const guide = injected('运行时上下文')
  const task = user('继续')
  const result = prepareStepMessages([task, guide], {
    events: [turnEnd(1, 'max-tokens')],
    turn: 2,
  })

  assert.strictEqual(result[0], guide)
  assert.equal(result[1].source?.plugin, 'dsh-user-task-priority')
  assert.equal(result[1].source?.form, 'max-tokens-continuation')
  assert.strictEqual(result[2], task)
})

test('guard message is plugin context with a unique id and leaves the user object intact', () => {
  const guide = injected('运行时上下文')
  const task = user('next')
  const result = prepareStepMessages([task, guide], {
    events: [turnEnd(1, 'max-tokens')],
    turn: 2,
  })
  const guard = result[1]

  assert.match(guard.id, /^dsh-continuation-guard-/)
  assert.deepEqual(guard.source, {
    kind: 'plugin',
    plugin: 'dsh-user-task-priority',
    form: 'max-tokens-continuation',
  })
  assert.deepEqual(guard.content, [{ type: 'text', text: CONTINUATION_GUARD_TEXT }])
  assert.strictEqual(result[2], task)
})

test('does not inject the guard for non-continuation work or non-max-token turns', () => {
  const guide = injected('运行时上下文')
  const task = user('please inspect the next file')
  const ordered = [guide, task]

  assert.equal(shouldAddContinuationGuard(ordered, [turnEnd(1, 'max-tokens')], 2), false)
  assert.equal(shouldAddContinuationGuard([guide, user('continue')], [turnEnd(1, 'completed')], 2), false)
  assert.strictEqual(prepareStepMessages(ordered, { events: [turnEnd(1, 'max-tokens')], turn: 2 }), ordered)
})
