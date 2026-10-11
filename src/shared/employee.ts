import { z } from 'zod'

export const employeeInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().min(1, 'Position is required'),
  department: z.string().min(1, 'Department is required'),
  phone: z.string().nullish(),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  salary: z.coerce.number().nonnegative('Salary must be ≥ 0')
})

export type EmployeeInput = z.infer<typeof employeeInputSchema>

export interface Employee extends EmployeeInput {
  id: number
  createdAt: string
  updatedAt: string
}

export const pinSchema = z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits')

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  department: z.string().optional()
})

export type EmployeeQuery = z.input<typeof employeeQuerySchema>

export type EmployeePage = {
  employees: Employee[]
  total: number
  page: number
  pageCount: number
}

export type CsvRowError = { row: number; field: string; message: string }

export type IpcResult<T> =
  { success: true; data: T } | { success: false; message: string; errors?: CsvRowError[] }
