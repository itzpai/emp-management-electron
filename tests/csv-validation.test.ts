import { describe, expect, it } from 'vitest'
import { validateEmployeeRows } from '../src/main/csv'

const VALID_ROW = {
  name: 'Jane Doe',
  position: 'Software Engineer',
  department: 'Engineering',
  phone: '+1 555 0100',
  joinedDate: '2026-10-10',
  salary: '50000'
}

describe('validateEmployeeRows', () => {
  it('returns all valid rows and no errors for valid input', () => {
    const { valid, errors } = validateEmployeeRows([
      VALID_ROW,
      { ...VALID_ROW, name: 'John Smith' }
    ])
    expect(errors).toEqual([])
    expect(valid).toHaveLength(2)
    expect(valid[0]).toEqual({
      name: 'Jane Doe',
      position: 'Software Engineer',
      department: 'Engineering',
      phone: '+1 555 0100',
      joinedDate: '2026-10-10',
      salary: 50000
    })
  })

  it('aggregates every issue from every row with exact row numbers', () => {
    const { valid, errors } = validateEmployeeRows([
      { ...VALID_ROW, name: '', joinedDate: 'not-a-date' },
      { ...VALID_ROW, salary: '-5' },
      VALID_ROW
    ])
    expect(valid).toHaveLength(1)
    expect(errors).toEqual([
      { row: 2, field: 'name', message: 'Name is required' },
      { row: 2, field: 'joinedDate', message: 'Use YYYY-MM-DD' },
      { row: 3, field: 'salary', message: 'Salary must be ≥ 0' }
    ])
  })

  it('reports every invalid field of an entirely empty row', () => {
    const { valid, errors } = validateEmployeeRows([
      { name: '', position: '', department: '', phone: '', joinedDate: '', salary: '' }
    ])
    expect(valid).toEqual([])
    expect(errors.map((e) => [e.row, e.field])).toEqual([
      [2, 'name'],
      [2, 'position'],
      [2, 'department'],
      [2, 'joinedDate']
    ])
  })

  it('treats an empty phone as valid', () => {
    const { valid, errors } = validateEmployeeRows([{ ...VALID_ROW, phone: '' }])
    expect(errors).toEqual([])
    expect(valid[0]?.phone).toBe('')
  })

  it('never throws on malformed values', () => {
    expect(() =>
      validateEmployeeRows([{ ...VALID_ROW, salary: 'not-a-number', joinedDate: '13/45/2026' }])
    ).not.toThrow()
  })
})
