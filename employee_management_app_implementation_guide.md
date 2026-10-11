# Electron Offline Employee Management App — Implementation Guide (v2)

This document is the authoritative technical specification for building an **offline desktop application** for employee management using **Electron, React, TypeScript, Tailwind CSS v4, Shadcn UI, Prisma, and SQLite**.

**v2 status:** The original draft (v1) was reviewed and its tech stack decisions were locked after discussion. All v1 code samples are superseded — this version is the single source of truth. v1 remains useful only as a feature reference. See §11 for the full list of deviations from v1. v2 scope additions requested after review: **Change-PIN flow** and **CSV import/export** (§6.3, §6.4, §8).

---

## 1. Tech Stack & Architecture

### 1.1 Locked decisions

| Layer            | Decision                                  | Notes                                                                                                                        |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Desktop shell    | **Electron + electron-vite**              | Tauri 2 evaluated and rejected: Prisma incompatibility and Rust toolchain cost outweigh the bundle-size benefit.             |
| Database         | **SQLite via Prisma**                     | Supabase was considered and **rejected** — the app must work fully offline with no cloud dependency or account.              |
| Frontend         | **React + TypeScript**                    | Via the electron-vite React/TS template.                                                                                     |
| Styling          | **Tailwind CSS v4**                       | `@tailwindcss/vite` plugin, CSS-first config. **No `tailwind.config.js`** (that is the v3 workflow — do not follow v1 §3.2). |
| UI components    | **Shadcn UI + lucide-react**              | Radix primitives, owned components.                                                                                          |
| Forms            | **react-hook-form + @hookform/resolvers** | Used for Add/Edit employee dialogs, the lock PIN dialog, and the Change-PIN dialog.                                          |
| Validation       | **zod**                                   | Single source of truth for types: validates IPC payloads, JSON/CSV imports, and form input.                                  |
| CSV parsing      | **papaparse**                             | Main process only. RFC 4180 edge cases (quoted commas, CRLF, BOM) are bug-prone when hand-rolled.                            |
| Password storage | **`node:crypto` scrypt**                  | Built into Node — no extra dependency. v1's plaintext `lockPassword` is forbidden.                                           |
| Packaging        | **electron-builder**                      | Ships with the electron-vite template; config in §9.                                                                         |

### 1.2 Key features

1. **Employee Management** — complete CRUD (v1 omitted Update; §6.4 adds `update-employee`).
2. **Data Import & Export** — JSON (backup round-trip) and CSV (Excel-friendly), via `fs` and Electron `dialog`; all imports are zod-validated and bulk-inserted.
3. **App Lock / Read-Only Mode** — PIN-protected via database settings; PIN stored as scrypt hash + salt; **Change-PIN flow included** (default `1234` is replaceable).

### 1.3 Process architecture

```
┌───────────────────────────── Electron ─────────────────────────────┐
│  Renderer (React)          Preload                Main (Node)      │
│  UI + forms + state   →    contextBridge     →    IPC handlers    │
│  window.api.*              (typed, no Node)       PrismaClient     │
│                                                   zod + papaparse  │
│                                                   fs + dialog      │
│                                                        │           │
│                                                  SQLite file at    │
│                                                  userData path     │
└────────────────────────────────────────────────────────────────────┘
```

All IPC handlers return a uniform envelope:

```typescript
type IpcResult<T> = { success: true; data: T } | { success: false; message: string }
```

The renderer never touches Node, files, or the database directly.

---

## 2. Project Initialization

### Step 1: Scaffold

```bash
npm create @quick-start/electron@latest employee-manager
#   Framework: React
#   Add TypeScript: Yes
cd employee-manager
npm install
```

### Step 2: Dependencies

```bash
npm install @prisma/client lucide-react react-hook-form zod @hookform/resolvers papaparse
npm install -D prisma tailwindcss @tailwindcss/vite @types/papaparse
```

---

## 3. Configuration Setup

### 3.1 `electron.vite.config.ts`

Path aliases for both renderer (`@`, `@renderer`) and a shared folder (`@shared`) used by main + renderer for zod schemas and types. `externalizeDepsPlugin()` **must stay** — it keeps `@prisma/client` external to the bundle, which is required for packaging (§9).

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

### 3.2 TypeScript path aliases

The template splits tsconfig into `tsconfig.node.json` (main/preload) and `tsconfig.web.json` (renderer). Add to both `compilerOptions`:

```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/renderer/src/*"],
    "@shared/*": ["./src/shared/*"]
  }
}
```

`tsconfig.node.json` only needs `@shared/*`. If the editor cannot resolve `@shared` types in the renderer, add `"../shared/**/*"` to `tsconfig.web.json` `include`.

### 3.3 Tailwind v4 (CSS-first — replaces v1 §3.2 entirely)

No `tailwind.config.js`, no `npx tailwindcss init`. Tailwind v4 is wired through the Vite plugin (§3.1) plus one import in the global stylesheet:

```css
/* src/renderer/src/assets/main.css */
@import 'tailwindcss';
```

Theme tokens (colors, radius) are declared in CSS via `@theme` — the shadcn init step (§3.4) writes these automatically.

### 3.4 Shadcn UI

```bash
npx shadcn@latest init          # detects Tailwind v4, writes components.json + CSS variables
npx shadcn@latest add button input label table dialog alert-dialog card form sonner dropdown-menu
```

`sonner` replaces all native `alert()` calls (v1 pattern is forbidden). `alert-dialog` replaces `confirm()`. `form` provides the react-hook-form bindings. `dropdown-menu` powers the Export/Import format menus (§8.2).

---

## 4. Shared Schemas & Types (`src/shared/`)

One module consumed by main (validation) and renderer (forms + types). This replaces v1's `any`-typed IPC.

```typescript
// src/shared/employee.ts
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
  createdAt: string // ISO string; serialized in main before crossing IPC
}

export const pinSchema = z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits')

export type IpcResult<T> = { success: true; data: T } | { success: false; message: string }
```

`employeeInputSchema` is the single validation gate for **every** write path: Add/Edit forms, JSON import, and CSV import. The strict `joinedDate` format also applies to imported files — exports produced by this app always comply.

---

## 5. Database Setup (Prisma & SQLite)

### 5.1 `prisma/schema.prisma`

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Employee {
  id         Int      @id @default(autoincrement())
  name       String
  position   String
  department String
  phone      String?
  joinedDate String
  salary     Float
  createdAt  DateTime @default(now())
}

model AppSetting {
  id           Int     @id @default(autoincrement())
  isLocked     Boolean @default(false)
  passwordHash String
  passwordSalt String
}
```

Changes vs v1: `lockPassword` (plaintext, hardcoded `"1234"`) is replaced by `passwordHash` + `passwordSalt`; the URL uses `env("DATABASE_URL")`.

### 5.2 Development database

`.env` (development only, never shipped):

```
DATABASE_URL="file:./employee.db"
```

```bash
npx prisma migrate dev --name init
npx prisma generate
```

This produces the migrated, empty `prisma/employee.db` used in dev and bundled for production (§5.3, §9).

### 5.3 Runtime DB location — required deviation from v1

v1's `file:./employee.db` resolves against the **install directory** in a packaged build, which is read-only and shared — it breaks. The main process must:

1. Point `DATABASE_URL` at `app.getPath('userData')` **before** constructing `PrismaClient`.
2. Provision the file by **copy-on-first-run**: if `userData/employee.db` does not exist, copy the bundled `prisma/employee.db` from resources.

(Alternative: run `prisma migrate deploy` against bundled migrations at startup. Rejected for now — more moving parts than copying one file.)

---

## 6. Backend Implementation (Main Process & IPC)

### 6.1 Database client (`src/main/db.ts`)

```typescript
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

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
```

### 6.2 Password hashing (`src/main/password.ts`)

```typescript
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEYLEN = 64

export function hashPassword(password: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = randomBytes(16).toString('hex')
  const passwordHash = scryptSync(password, passwordSalt, KEYLEN).toString('hex')
  return { passwordHash, passwordSalt }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, KEYLEN)
  const stored = Buffer.from(hash, 'hex')
  return candidate.length === stored.length && timingSafeEqual(candidate, stored)
}
```

The default PIN `1234` is preserved as a UX default but is **hashed at seed time** — it never exists in plaintext in the database, and the Change-PIN flow (§6.4) retires it.

### 6.3 CSV helpers (`src/main/csv.ts`)

CSV contract: **header row required**, columns `name,position,department,phone,joinedDate,salary`, dates `YYYY-MM-DD`, UTF-8. Exports are written with a leading BOM so Excel opens them correctly; imports strip it.

```typescript
import Papa from 'papaparse'
import type { Employee } from '@shared/employee'

export const EMPLOYEE_CSV_COLUMNS = [
  'name',
  'position',
  'department',
  'phone',
  'joinedDate',
  'salary'
] as const

export function toEmployeeCsv(employees: Employee[]): string {
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
```

(`Papa.unparse` handles all RFC 4180 quoting — commas, quotes, newlines inside fields.)

### 6.4 IPC handlers (`src/main/ipc.ts`)

```typescript
import { dialog, ipcMain } from 'electron'
import fs from 'node:fs'
import Papa from 'papaparse'
import { z } from 'zod'
import { db } from './db'
import { hashPassword, verifyPassword } from './password'
import { EMPLOYEE_CSV_COLUMNS, toEmployeeCsv } from './csv'
import {
  employeeInputSchema,
  pinSchema,
  type Employee,
  type EmployeeInput,
  type IpcResult
} from '@shared/employee'

const DEFAULT_PIN = '1234'

async function ensureSetting() {
  const existing = await db().appSetting.findFirst()
  if (existing) return existing
  return db().appSetting.create({ data: { isLocked: false, ...hashPassword(DEFAULT_PIN) } })
}

async function assertUnlocked() {
  const setting = await ensureSetting()
  if (setting.isLocked) throw new Error('App is locked!')
}

function fail(error: unknown): IpcResult<never> {
  return { success: false, message: error instanceof Error ? error.message : String(error) }
}

export function registerIpcHandlers(): void {
  // --- Employees: read is always allowed ---
  ipcMain.handle('get-employees', async (): Promise<IpcResult<Employee[]>> => {
    try {
      const rows = await db().employee.findMany({ orderBy: { id: 'desc' } })
      const employees = rows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))
      return { success: true, data: employees }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('add-employee', async (_, data: unknown): Promise<IpcResult<Employee>> => {
    try {
      await assertUnlocked()
      const input = employeeInputSchema.parse(data)
      const employee = await db().employee.create({ data: input })
      return { success: true, data: { ...employee, createdAt: employee.createdAt.toISOString() } }
    } catch (error) {
      return fail(error)
    }
  })

  // NEW in v2 — v1 shipped only add/delete
  ipcMain.handle(
    'update-employee',
    async (_, id: number, data: unknown): Promise<IpcResult<Employee>> => {
      try {
        await assertUnlocked()
        const input = employeeInputSchema.parse(data)
        const employee = await db().employee.update({ where: { id }, data: input })
        return { success: true, data: { ...employee, createdAt: employee.createdAt.toISOString() } }
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

  // --- Export: read-only, allowed while locked ---
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

  // NEW in v2 — CSV export
  ipcMain.handle('export-employees-csv', async (): Promise<IpcResult<string>> => {
    try {
      const employees = await db().employee.findMany({ orderBy: { id: 'desc' } })
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export Employees (CSV)',
        defaultPath: 'employees-export.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })
      if (canceled || !filePath) return { success: false, message: 'Export cancelled.' }
      fs.writeFileSync(filePath, '\uFEFF' + toEmployeeCsv(employees), 'utf-8') // BOM: Excel reads UTF-8
      return { success: true, data: filePath }
    } catch (error) {
      return fail(error)
    }
  })

  // --- Import: zod-validated, bulk insert (v1 parsed untrusted JSON blindly) ---
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

  // NEW in v2 — CSV import with per-row error reporting
  ipcMain.handle('import-employees-csv', async (): Promise<IpcResult<number>> => {
    try {
      await assertUnlocked()
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Import Employees (CSV)',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })
      if (canceled || !filePaths[0]) return { success: false, message: 'No file selected.' }

      const text = fs.readFileSync(filePaths[0], 'utf-8').replace(/^\uFEFF/, '') // strip BOM
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

      const rows: EmployeeInput[] = []
      for (let i = 0; i < csv.data.length; i++) {
        const parsed = employeeInputSchema.safeParse(csv.data[i])
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          // +2: 1-based rows plus the header row
          return {
            success: false,
            message: `Row ${i + 2} invalid ("${issue.path.join('.')}") — ${issue.message}`
          }
        }
        rows.push(parsed.data)
      }

      const result = await db().employee.createMany({ data: rows })
      return { success: true, data: result.count }
    } catch (error) {
      return fail(error)
    }
  })

  // --- Lock ---
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

  // NEW in v2 — Change PIN (v1 had no way to retire the default PIN)
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
```

### 6.5 Wiring (`src/main/index.ts`)

Keep the template's `BrowserWindow` setup (it already has `contextIsolation: true`, `nodeIntegration: false`, sandboxed preload). Add:

```typescript
import { initDb } from './db'
import { registerIpcHandlers } from './ipc'

app.whenReady().then(() => {
  initDb()
  registerIpcHandlers()
  createWindow()
})
```

---

## 7. Preload Bridge (`src/preload/index.ts`)

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { EmployeeInput } from '@shared/employee'

contextBridge.exposeInMainWorld('api', {
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  addEmployee: (data: EmployeeInput) => ipcRenderer.invoke('add-employee', data),
  updateEmployee: (id: number, data: EmployeeInput) =>
    ipcRenderer.invoke('update-employee', id, data),
  deleteEmployee: (id: number) => ipcRenderer.invoke('delete-employee', id),
  exportEmployees: () => ipcRenderer.invoke('export-employees'),
  exportEmployeesCsv: () => ipcRenderer.invoke('export-employees-csv'),
  importEmployees: () => ipcRenderer.invoke('import-employees'),
  importEmployeesCsv: () => ipcRenderer.invoke('import-employees-csv'),
  getLockStatus: () => ipcRenderer.invoke('get-lock-status'),
  toggleLock: (pin: string) => ipcRenderer.invoke('toggle-lock', pin),
  changePin: (currentPin: string, newPin: string) =>
    ipcRenderer.invoke('change-pin', currentPin, newPin)
})
```

Typed declarations (`src/preload/index.d.ts`) — no `any` (v1 pattern is forbidden):

```typescript
import type { Employee, EmployeeInput, IpcResult } from '@shared/employee'

export interface IApi {
  getEmployees: () => Promise<IpcResult<Employee[]>>
  addEmployee: (data: EmployeeInput) => Promise<IpcResult<Employee>>
  updateEmployee: (id: number, data: EmployeeInput) => Promise<IpcResult<Employee>>
  deleteEmployee: (id: number) => Promise<IpcResult<null>>
  exportEmployees: () => Promise<IpcResult<string>>
  exportEmployeesCsv: () => Promise<IpcResult<string>>
  importEmployees: () => Promise<IpcResult<number>>
  importEmployeesCsv: () => Promise<IpcResult<number>>
  getLockStatus: () => Promise<IpcResult<{ isLocked: boolean }>>
  toggleLock: (pin: string) => Promise<IpcResult<{ isLocked: boolean }>>
  changePin: (currentPin: string, newPin: string) => Promise<IpcResult<null>>
}

declare global {
  interface Window {
    api: IApi
  }
}
```

---

## 8. Frontend UI Implementation

### 8.1 Component structure

```
src/renderer/src/
├── App.tsx
├── components/
│   ├── EmployeeTable.tsx         # list + row actions (edit / delete)
│   ├── EmployeeFormDialog.tsx    # Add + Edit form (react-hook-form + zod)
│   ├── DeleteEmployeeDialog.tsx  # AlertDialog confirmation
│   ├── LockDialog.tsx            # PIN prompt (locks or unlocks)
│   └── ChangePinDialog.tsx       # current PIN + new PIN + confirm (v2)
└── hooks/
    └── useEmployeeStore.ts       # employees + isLocked state and actions
```

### 8.2 Interaction rules (v1 violations corrected)

- **Never** use `alert()`, `prompt()`, or `confirm()`. Feedback goes through **sonner toasts**; prompts go through shadcn **Dialog/AlertDialog**.
- While `isLocked` is true: Add, Edit, Delete, and both Import formats are `disabled`, and a destructive banner explains why. Export (JSON and CSV) and viewing remain available.
- The lock button opens `LockDialog` (PIN input, default `1234`) instead of `window.prompt`.
- Export and Import are **dropdown menus** (`dropdown-menu`) offering _JSON backup_ and _CSV (Excel)_ — not two button pairs.
- **Change PIN is available in both lock states** — it requires the current PIN, so it is not a lock bypass.

Header action layout:

```tsx
<DropdownMenu>{/* Export   → JSON backup | CSV (Excel) */}</DropdownMenu>
<DropdownMenu>{/* Import   → JSON backup | CSV (Excel) — disabled={isLocked} */}</DropdownMenu>
<Button disabled={isLocked}><UserPlus /> Add</Button>
<ChangePinDialog />
<Button variant={isLocked ? 'destructive' : 'default'}>{/* Lock / Unlock → LockDialog */}</Button>
```

### 8.3 Form dialog patterns (react-hook-form + zod)

```tsx
// EmployeeFormDialog.tsx (condensed)
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { employeeInputSchema, type Employee, type EmployeeInput } from '@shared/employee'

export function EmployeeFormDialog({
  employee,
  onSaved
}: {
  employee?: Employee
  onSaved: () => void
}) {
  const form = useForm<EmployeeInput>({
    resolver: zodResolver(employeeInputSchema),
    defaultValues: employee ?? {
      name: '',
      position: '',
      department: '',
      phone: '',
      joinedDate: '',
      salary: 0
    }
  })

  const onSubmit = async (values: EmployeeInput) => {
    const res = employee
      ? await window.api.updateEmployee(employee.id, values)
      : await window.api.addEmployee(values)
    if (res.success) {
      toast.success(employee ? 'Employee updated.' : 'Employee added.')
      onSaved()
    } else {
      toast.error(res.message)
    }
  }

  return (
    <Dialog>
      {/* DialogTrigger / DialogContent with <Form {...form}> wrapping
          name, position, department, phone, joinedDate (date input), salary fields */}
    </Dialog>
  )
}
```

```tsx
// ChangePinDialog.tsx (condensed, v2)
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { pinSchema } from '@shared/employee'

const changePinFormSchema = z
  .object({ currentPin: pinSchema, newPin: pinSchema, confirmPin: z.string() })
  .refine((v) => v.newPin === v.confirmPin, { path: ['confirmPin'], message: 'PINs do not match' })

type ChangePinValues = z.infer<typeof changePinFormSchema>

export function ChangePinDialog() {
  const [open, setOpen] = useState(false)
  const form = useForm<ChangePinValues>({
    resolver: zodResolver(changePinFormSchema),
    defaultValues: { currentPin: '', newPin: '', confirmPin: '' }
  })

  const onSubmit = async (values: ChangePinValues) => {
    const res = await window.api.changePin(values.currentPin, values.newPin)
    if (res.success) {
      toast.success('PIN changed.')
      setOpen(false)
      form.reset()
    } else {
      toast.error(res.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Trigger: "Change PIN" button; content: three password inputs bound via <Form> */}
    </Dialog>
  )
}
```

### 8.4 `App.tsx` responsibilities

1. On mount: `getLockStatus()` + `getEmployees()`.
2. Header: title + actions (Export/Import dropdowns, Add, Change PIN, Lock/Unlock button showing current state).
3. Locked banner when `isLocked`.
4. `EmployeeTable` with Edit + Delete (AlertDialog) row actions.
5. Refresh the list after every successful mutation or import (JSON and CSV).

Adding TanStack Query over these IPC calls is optional and deferred (§12) — plain state is acceptable at this scale.

---

## 9. Build & Packaging (`electron-builder`)

The template ships an `electron-builder.yml`. Extend it — v1's `extraResources`-only approach is **not sufficient**, because Prisma engine binaries inside `node_modules/.prisma` must be **unpacked from the ASAR archive** at runtime:

```yaml
appId: com.breeze.employee-manager
productName: Employee Manager

asarUnpack:
  - '**/node_modules/.prisma/**/*'
  - '**/*.node'

extraResources:
  - from: prisma
    to: prisma
    filter:
      - 'employee.db' # migrated, empty — copied to userData on first run (§5.3)
      - 'schema.prisma'
      - 'migrations/**/*'
```

Additional requirements:

- `externalizeDepsPlugin()` stays in `electron.vite.config.ts` (§3.1) so `@prisma/client` (and `papaparse`, pure JS) resolve from `node_modules` at runtime — no extra packaging steps for CSV support.
- `@prisma/client` regenerates on install: add `"postinstall": "prisma generate"` to `package.json` if the template lacks it.
- Never ship `.env` (electron-builder excludes it by default — verify).

```bash
npm run build        # compile + render build
npm run build:win    # packaged installer (Windows target)
```

---

## 10. Security Notes & Known Limits

1. **The app lock is a UX guard, not security.** The SQLite file is unencrypted; anyone with file access can read it. Acceptable for this app's purpose; SQLCipher is the future fix (§12).
2. **Default PIN `1234`** is stored only as a scrypt hash and is **replaceable via the built-in Change-PIN flow** (§6.4, §8.3) — users should change it on first run.
3. **All IPC payloads are untrusted input.** Every handler validates with zod before touching Prisma (§6.4) — the renderer is treated as a hostile surface, per Electron security guidance.
4. Template defaults (`contextIsolation: true`, `nodeIntegration: false`, sandboxed preload) must not be weakened.

---

## 11. Deviations from the v1 Draft (Traceability)

| #   | v1 draft                                             | v2 decision                                                        | Reason                                                                              |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | Tailwind v3 setup (`tailwindcss init -p`, config JS) | **Tailwind v4** (`@tailwindcss/vite`, CSS-first)                   | Locked in discussion; shadcn supports v4; v3 workflow is legacy                     |
| 2   | `lockPassword` plaintext, default `"1234"` in DB     | **scrypt hash + salt** via `node:crypto`                           | No plaintext credentials at rest; zero new dependencies                             |
| 3   | `alert()` / `prompt()` / `confirm()` in renderer     | **shadcn Dialog/AlertDialog + sonner toasts**                      | Native dialogs block the renderer and look foreign in a desktop app                 |
| 4   | No update employee (add/delete only)                 | **Full CRUD** (`update-employee` + Edit UI)                        | "CRUD" in §1.2 was unmet in v1                                                      |
| 5   | Import `JSON.parse` straight into DB, per-row loop   | **zod validation + `createMany` bulk insert**                      | Untrusted file input; atomicity and speed                                           |
| 6   | `file:./employee.db` relative path                   | **`DATABASE_URL` → `app.getPath('userData')` + copy-on-first-run** | Relative path breaks in packaged (read-only) installs                               |
| 7   | Packaging = `extraResources` only                    | **+ `asarUnpack` for `.prisma` engines**                           | Engine binaries cannot be read from inside the ASAR archive                         |
| 8   | `any`-typed IPC and preload                          | **Shared zod schemas + typed `IpcResult<T>`**                      | Type safety across the IPC boundary; zod doubles as form validator                  |
| 9   | —                                                    | **react-hook-form + @hookform/resolvers**                          | Locked in discussion; forms did not exist in v1                                     |
| 10  | — (Supabase was briefly considered)                  | **Rejected — stays SQLite/offline**                                | App must run with no cloud dependency; SQLite also matches the JSON backup workflow |
| 11  | No CSV support (JSON only)                           | **CSV import + export** via papaparse (§6.3, §6.4)                 | Requested scope: Excel-friendly exchange; JSON kept for backup round-trips          |
| 12  | PIN immutable after seeding (no way off `1234`)      | **Change-PIN flow** (§6.4, §8.3)                                   | Requested scope: default PIN must be replaceable                                    |

---

## 12. Optional Future Work

- **TanStack Query** over IPC calls once list filtering/sorting grows.
- **SQLCipher** if data-at-rest encryption becomes a requirement.
- **electron-updater** for auto-updates.
- **Tray / minimize-to-tray** behavior.
