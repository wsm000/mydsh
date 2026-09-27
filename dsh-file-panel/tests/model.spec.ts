/**
 * Pure client model tests: relative-path algebra and display formatting.
 */
import { describe, expect, it } from 'vitest'
import { fileNameOf, formatLimit, formatSize, formatTime, joinRel, parentOf, segmentsOf } from '../src/client/model.ts'

describe('path algebra', () => {
  it('computes parents, joins, names, and segments', () => {
    expect(parentOf('')).toBe('')
    expect(parentOf('a')).toBe('')
    expect(parentOf('a/b')).toBe('a')
    expect(parentOf('a/b/c')).toBe('a/b')
    expect(joinRel('', 'x')).toBe('x')
    expect(joinRel('a', 'x')).toBe('a/x')
    expect(fileNameOf('')).toBe('')
    expect(fileNameOf('a')).toBe('a')
    expect(fileNameOf('a/b/c.txt')).toBe('c.txt')
    expect(segmentsOf('')).toEqual([])
    expect(segmentsOf('a/b')).toEqual(['a', 'b'])
  })
})

describe('formatSize', () => {
  it('formats byte counts compactly', () => {
    expect(formatSize(null)).toBe('—')
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1024)).toBe('1.00 KB')
    expect(formatSize(1536)).toBe('1.50 KB')
    expect(formatSize(1024 * 1024)).toBe('1.00 MB')
  })
})

describe('formatTime', () => {
  it('renders a dash for unknown and a date string otherwise', () => {
    expect(formatTime(0)).toBe('—')
    const text = formatTime(1780000000000)
    expect(text).toMatch(/\d{4}\//)
  })
})

describe('formatLimit', () => {
  it('reuses the size formatter', () => {
    expect(formatLimit(1024)).toBe('1.00 KB')
  })
})
