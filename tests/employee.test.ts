import { describe, expect, it } from 'vitest'
import { employeeInputSchema, employeeQuerySchema, pinSchema } from '@shared/employee'

const VALID_INPUT = {
  name: 'Jane Doe',
  position: 'Software Engineer',
  department: 'Engineering',
  phone: '+1 555 0100',
  joinedDate: '2026-10-10',
  salary: 50000
}

describe('employeeInputSchema', () => {
  it('parses a valid input', () => {
    expect(employeeInputSchema.parse(VALID_INPUT)).toEqual(VALID_INPUT)
  })

  it('coerces salary from a string', () => {
    const parsed = employeeInputSchema.parse({ ...VALID_INPUT, salary: '50000.5' })
    expect(parsed.salary).toBe(50000.5)
  })

  it('rejects an empty name', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, name: '' }).success).toBe(false)
  })

  it('rejects an empty position', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, position: '' }).success).toBe(false)
  })

  it('rejects an empty department', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, department: '' }).success).toBe(false)
  })

  it('accepts a valid joinedDate', () => {
    expect(
      employeeInputSchema.safeParse({ ...VALID_INPUT, joinedDate: '2026-10-10' }).success
    ).toBe(true)
  })

  it('rejects a non-YYYY-MM-DD joinedDate', () => {
    expect(
      employeeInputSchema.safeParse({ ...VALID_INPUT, joinedDate: '10/10/2026' }).success
    ).toBe(false)
  })

  it('rejects a joinedDate with wrong separators', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, joinedDate: '20261010' }).success).toBe(
      false
    )
  })

  it('rejects a negative salary', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, salary: -1 }).success).toBe(false)
  })

  it('accepts a null phone', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, phone: null }).success).toBe(true)
  })

  it('accepts a missing phone', () => {
    const input: Partial<typeof VALID_INPUT> = { ...VALID_INPUT }
    delete input.phone
    expect(employeeInputSchema.safeParse(input).success).toBe(true)
  })

  it('accepts an empty phone', () => {
    expect(employeeInputSchema.safeParse({ ...VALID_INPUT, phone: '' }).success).toBe(true)
  })
})

describe('pinSchema', () => {
  it('rejects 3 digits', () => {
    expect(pinSchema.safeParse('123').success).toBe(false)
  })

  it('accepts 4 digits', () => {
    expect(pinSchema.safeParse('1234').success).toBe(true)
  })

  it('accepts 8 digits', () => {
    expect(pinSchema.safeParse('12345678').success).toBe(true)
  })

  it('rejects 9 digits', () => {
    expect(pinSchema.safeParse('123456789').success).toBe(false)
  })

  it('rejects non-digits', () => {
    expect(pinSchema.safeParse('12a4').success).toBe(false)
    expect(pinSchema.safeParse('abcd').success).toBe(false)
    expect(pinSchema.safeParse('12 4').success).toBe(false)
  })
})

describe('employeeQuerySchema', () => {
  it('applies defaults', () => {
    expect(employeeQuerySchema.parse({})).toEqual({ page: 1, limit: 10 })
  })

  it('coerces page and limit from strings', () => {
    expect(employeeQuerySchema.parse({ page: '3', limit: '25' })).toEqual({
      page: 3,
      limit: 25
    })
  })

  it('keeps search and department', () => {
    expect(employeeQuerySchema.parse({ search: '  jane  ', department: 'Engineering' })).toEqual({
      page: 1,
      limit: 10,
      search: 'jane',
      department: 'Engineering'
    })
  })

  it('rejects a page below 1', () => {
    expect(() => employeeQuerySchema.parse({ page: 0 })).toThrow()
  })

  it('rejects a non-numeric page', () => {
    expect(() => employeeQuerySchema.parse({ page: 'abc' })).toThrow()
  })

  it('rejects a limit below 1', () => {
    expect(() => employeeQuerySchema.parse({ limit: 0 })).toThrow()
  })

  it('rejects a limit above 100', () => {
    expect(() => employeeQuerySchema.parse({ limit: 101 })).toThrow()
  })

  it('rejects a search longer than 100 characters', () => {
    expect(() => employeeQuerySchema.parse({ search: 'x'.repeat(101) })).toThrow()
  })
})
