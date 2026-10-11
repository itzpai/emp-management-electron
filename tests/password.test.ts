import { scryptSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/main/password'

describe('hashPassword', () => {
  it('generates a unique salt per call', () => {
    const a = hashPassword('same-password')
    const b = hashPassword('same-password')
    expect(a.passwordSalt).not.toBe(b.passwordSalt)
    expect(a.passwordHash).not.toBe(b.passwordHash)
  })

  it('returns hex-encoded salt (16 bytes) and hash (64 bytes)', () => {
    const { passwordSalt, passwordHash } = hashPassword('hunter2')
    expect(passwordSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(passwordHash).toMatch(/^[0-9a-f]{128}$/)
  })
})

describe('verifyPassword', () => {
  it('returns true for the correct password', () => {
    const { passwordHash, passwordSalt } = hashPassword('correct-horse')
    expect(verifyPassword('correct-horse', passwordSalt, passwordHash)).toBe(true)
  })

  it('returns false for a wrong password', () => {
    const { passwordHash, passwordSalt } = hashPassword('correct-horse')
    expect(verifyPassword('wrong-horse', passwordSalt, passwordHash)).toBe(false)
  })

  it('reproduces the hash for the same password and salt', () => {
    const { passwordSalt, passwordHash } = hashPassword('deterministic')
    expect(scryptSync('deterministic', passwordSalt, 64).toString('hex')).toBe(passwordHash)
  })

  it('returns false for a mismatched-length hash without throwing', () => {
    const { passwordSalt } = hashPassword('some-password')
    expect(() => verifyPassword('some-password', passwordSalt, 'abcd')).not.toThrow()
    expect(verifyPassword('some-password', passwordSalt, 'abcd')).toBe(false)
  })

  it('returns false for a tampered hash without throwing', () => {
    const { passwordHash, passwordSalt } = hashPassword('some-password')
    const tampered = (passwordHash[0] === '0' ? '1' : '0') + passwordHash.slice(1)
    expect(() => verifyPassword('some-password', passwordSalt, tampered)).not.toThrow()
    expect(verifyPassword('some-password', passwordSalt, tampered)).toBe(false)
  })
})
