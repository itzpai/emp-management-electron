import { dialog, ipcMain } from 'electron'
import fs from 'node:fs'
import Papa from 'papaparse'
import { z } from 'zod'
import type { AppSetting } from '@prisma/client'
import type { Prisma } from './generated/prisma'
import { db } from './db'
import { hashPassword, verifyPassword } from './password'
import { EMPLOYEE_CSV_COLUMNS, toEmployeeCsv, validateEmployeeRows } from './csv'
import {
  employeeInputSchema,
  employeeQuerySchema,
  pinSchema,
  type Employee,
  type EmployeePage,
  type IpcResult
} from '@shared/employee'

const DEFAULT_PIN = '1234'

async function ensureSetting(): Promise<AppSetting> {
  const existing = await db().appSetting.findFirst()
  if (existing) return existing
  return db().appSetting.create({ data: { isLocked: false, ...hashPassword(DEFAULT_PIN) } })
}

async function assertUnlocked(): Promise<void> {
  const setting = await ensureSetting()
  if (setting.isLocked) throw new Error('App is locked!')
}

function fail(error: unknown): IpcResult<never> {
  return { success: false, message: error instanceof Error ? error.message : String(error) }
}

function serialize(
  row: {
    createdAt: Date
    updatedAt: Date
  } & Record<string, unknown>
): Employee {
  return {
    ...(row as object),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  } as Employee
}

export function registerIpcHandlers(): void {
  ipcMain.handle('get-employees', async (_, query?: unknown): Promise<IpcResult<EmployeePage>> => {
    try {
      const { page, limit, search, department } = employeeQuerySchema.parse(query ?? {})
      const where: Prisma.EmployeeWhereInput = {}
      if (department) where.department = department
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { position: { contains: search } },
          { department: { contains: search } }
        ]
      }
      const [rows, total] = await Promise.all([
        db().employee.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        db().employee.count({ where })
      ])
      return {
        success: true,
        data: {
          employees: rows.map(serialize),
          total,
          page,
          pageCount: Math.max(1, Math.ceil(total / limit))
        }
      }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('get-departments', async (): Promise<IpcResult<string[]>> => {
    try {
      const rows = await db().employee.findMany({
        distinct: ['department'],
        select: { department: true },
        orderBy: { department: 'asc' }
      })
      return { success: true, data: rows.map((r) => r.department) }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('add-employee', async (_, data: unknown): Promise<IpcResult<Employee>> => {
    try {
      await assertUnlocked()
      const input = employeeInputSchema.parse(data)
      const row = await db().employee.create({ data: input })
      return { success: true, data: serialize(row) }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'update-employee',
    async (_, id: number, data: unknown): Promise<IpcResult<Employee>> => {
      try {
        await assertUnlocked()
        const input = employeeInputSchema.parse(data)
        const row = await db().employee.update({ where: { id }, data: input })
        return { success: true, data: serialize(row) }
      } catch (error) {
        return fail(error)
      }
    }
  )

  ipcMain.handle('delete-employee', async (_, id: number): Promise<IpcResult<null>> => {
    try {
      await assertUnlocked()
      await db().employee.delete({ where: { id } })
      return { success: true, data: null }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('export-employees', async (): Promise<IpcResult<string>> => {
    try {
      const employees = await db().employee.findMany({ orderBy: { id: 'desc' } })
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export Employees Backup',
        defaultPath: 'employees-backup.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      })
      if (canceled || !filePath) return { success: false, message: 'Export cancelled.' }
      fs.writeFileSync(filePath, JSON.stringify(employees, null, 2), 'utf-8')
      return { success: true, data: filePath }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('export-employees-csv', async (): Promise<IpcResult<string>> => {
    try {
      const employees = await db().employee.findMany({ orderBy: { id: 'desc' } })
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export Employees (CSV)',
        defaultPath: 'employees-export.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })
      if (canceled || !filePath) return { success: false, message: 'Export cancelled.' }
      fs.writeFileSync(filePath, '\uFEFF' + toEmployeeCsv(employees), 'utf-8')
      return { success: true, data: filePath }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('import-employees', async (): Promise<IpcResult<number>> => {
    try {
      await assertUnlocked()
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Import Employees (JSON backup)',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (canceled || !filePaths[0]) return { success: false, message: 'No file selected.' }

      const parsed = z
        .array(employeeInputSchema)
        .safeParse(JSON.parse(fs.readFileSync(filePaths[0], 'utf-8')))
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        return {
          success: false,
          message: `Invalid backup at "${first.path.join('.')}" — ${first.message}`
        }
      }
      const result = await db().employee.createMany({ data: parsed.data })
      return { success: true, data: result.count }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('import-employees-csv', async (): Promise<IpcResult<number>> => {
    try {
      await assertUnlocked()
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Import Employees (CSV)',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })
      if (canceled || !filePaths[0]) return { success: false, message: 'No file selected.' }

      const text = fs.readFileSync(filePaths[0], 'utf-8').replace(/^\uFEFF/, '')
      const csv = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy'
      })
      if (csv.errors.length) {
        return { success: false, message: `Malformed CSV: ${csv.errors[0].message}` }
      }

      const headers = Object.keys(csv.data[0] ?? {})
      const missing = EMPLOYEE_CSV_COLUMNS.filter((c) => !headers.includes(c))
      if (missing.length) {
        return { success: false, message: `CSV is missing required columns: ${missing.join(', ')}` }
      }

      const { valid, errors } = validateEmployeeRows(csv.data)
      if (errors.length > 0) {
        const failedRows = csv.data.length - valid.length
        return {
          success: false,
          message: `${failedRows} row(s) failed validation — no rows were imported.`,
          errors
        }
      }

      const result = await db().employee.createMany({ data: valid })
      return { success: true, data: result.count }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('get-lock-status', async (): Promise<IpcResult<{ isLocked: boolean }>> => {
    try {
      const setting = await ensureSetting()
      return { success: true, data: { isLocked: setting.isLocked } }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'toggle-lock',
    async (_, pin: string): Promise<IpcResult<{ isLocked: boolean }>> => {
      try {
        const setting = await ensureSetting()
        if (!verifyPassword(pin, setting.passwordSalt, setting.passwordHash)) {
          return { success: false, message: 'Incorrect PIN!' }
        }
        const updated = await db().appSetting.update({
          where: { id: setting.id },
          data: { isLocked: !setting.isLocked }
        })
        return { success: true, data: { isLocked: updated.isLocked } }
      } catch (error) {
        return fail(error)
      }
    }
  )

  ipcMain.handle(
    'change-pin',
    async (_, currentPin: string, newPin: string): Promise<IpcResult<null>> => {
      try {
        const setting = await ensureSetting()
        if (!verifyPassword(currentPin, setting.passwordSalt, setting.passwordHash)) {
          return { success: false, message: 'Current PIN is incorrect!' }
        }
        const pin = pinSchema.parse(newPin)
        await db().appSetting.update({ where: { id: setting.id }, data: hashPassword(pin) })
        return { success: true, data: null }
      } catch (error) {
        return fail(error)
      }
    }
  )
}
