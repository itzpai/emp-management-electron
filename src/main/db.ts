import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from './generated/prisma'

let prisma: PrismaClient | undefined

export function initDb(): PrismaClient {
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })

  const dbPath = path.join(userData, 'employee.db')
  if (!fs.existsSync(dbPath)) {
    const bundled = app.isPackaged
      ? path.join(process.resourcesPath, 'prisma', 'employee.db')
      : path.join(app.getAppPath(), 'prisma', 'employee.db')
    if (fs.existsSync(bundled)) fs.copyFileSync(bundled, dbPath)
  }

  process.env.DATABASE_URL = `file:${dbPath}`
  prisma = new PrismaClient()
  return prisma
}

export function db(): PrismaClient {
  if (!prisma) throw new Error('Database not initialized — call initDb() first')
  return prisma
}
