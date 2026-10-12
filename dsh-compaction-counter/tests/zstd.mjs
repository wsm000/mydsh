/**
 * Minimal DSH session-log reader for the tests: `.jsonl` passes through, and a
 * concatenated-frame `.jsonl.zstd` is split on frame boundaries and inflated
 * (Node's zstd binding is single-frame, DSH appends one frame per flush).
 */
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 4247762216

/** Walk the zstd frame headers to find each frame's byte range. */
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`invalid frame magic at byte ${offset}`)
    offset += 4
    if (offset === buffer.length) return { frames }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames }
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return { frames }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames }
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return { frames }
}

/**
 * Decode one session log to text.
 * @param file - `.jsonl` or concatenated-frame `.jsonl.zstd` path.
 * @returns the decoded UTF-8 text.
 */
export function readSessionText(file) {
  const raw = readFileSync(file)
  if (!file.endsWith('.zstd')) return raw.toString('utf8')
  const { frames } = scanZstdFrames(raw)
  return Buffer.concat(frames.map(({ start, end }) => zstdDecompressSync(raw.subarray(start, end)))).toString('utf8')
}

/**
 * Parse one session log into its events.
 * @param file - session log path.
 * @returns the parsed JSON event rows (malformed lines skipped).
 */
export function readSessionEvents(file) {
  const events = []
  for (const line of readSessionText(file).split('\n')) {
    if (!line.trim()) continue
    try {
      events.push(JSON.parse(line))
    } catch {
      /* torn tail line */
    }
  }
  return events
}
