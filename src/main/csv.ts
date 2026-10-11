import Papa from 'papaparse'
import { employeeInputSchema, type CsvRowError, type EmployeeInput } from '@shared/employee'

export const EMPLOYEE_CSV_COLUMNS = [
  'name',
  'position',
  'department',
  'phone',
  'joinedDate',
  'salary'
] as const

export function toEmployeeCsv(employees: EmployeeInput[]): string {
  return Papa.unparse(
    employees.map((e) => ({
      name: e.name,
      position: e.position,
      department: e.department,
      phone: e.phone ?? '',
      joinedDate: e.joinedDate,
      salary: e.salary
    }))
  )
}

export function validateEmployeeRows(rows: Record<string, string>[]): {
  valid: EmployeeInput[]
  errors: CsvRowError[]
} {
  const valid: EmployeeInput[] = []
  const errors: CsvRowError[] = []
  for (let i = 0; i < rows.length; i++) {
    const parsed = employeeInputSchema.safeParse(rows[i])
    if (parsed.success) {
      valid.push(parsed.data)
      continue
    }
    for (const issue of parsed.error.issues) {
      errors.push({
        row: i + 2,
        field: issue.path.join('.') || '(row)',
        message: issue.message
      })
    }
  }
  return { valid, errors }
}
