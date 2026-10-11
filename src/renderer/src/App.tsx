import { useState, type JSX } from 'react'
import { toast } from 'sonner'
import { Download, Lock, LockOpen, ShieldAlert, Upload, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ChangePinDialog } from './components/ChangePinDialog'
import { CsvImportErrorsDialog } from './components/CsvImportErrorsDialog'
import { DeleteEmployeeDialog } from './components/DeleteEmployeeDialog'
import { EmployeeFormDialog } from './components/EmployeeFormDialog'
import { EmployeeTable } from './components/EmployeeTable'
import { LockDialog } from './components/LockDialog'
import { Toaster } from './components/ui/sonner'
import { useEmployeeStore } from './hooks/useEmployeeStore'
import type { CsvRowError, Employee } from '@shared/employee'

export default function App(): JSX.Element {
  const store = useEmployeeStore()
  const { isLocked } = store

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [lockOpen, setLockOpen] = useState(false)
  const [csvErrors, setCsvErrors] = useState<CsvRowError[] | null>(null)

  const openAddDialog = (): void => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEditDialog = (employee: Employee): void => {
    setEditing(employee)
    setFormOpen(true)
  }

  const handleExport = async (kind: 'json' | 'csv'): Promise<void> => {
    const res = kind === 'json' ? await store.exportEmployees() : await store.exportEmployeesCsv()
    if (res.success) toast.success(`Exported to ${res.data}`)
    else toast.error(res.message)
  }

  const handleImport = async (kind: 'json' | 'csv'): Promise<void> => {
    setCsvErrors(null)
    const res = kind === 'json' ? await store.importEmployees() : await store.importEmployeesCsv()
    if (res.success)
      toast.success(`Imported ${res.data} ${res.data === 1 ? 'employee' : 'employees'}.`)
    else if (res.errors && res.errors.length > 0) setCsvErrors(res.errors)
    else toast.error(res.message)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Employee Manager</h1>
            <p className="text-sm text-muted-foreground">Offline employee records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void handleExport('json')}>
                  JSON backup
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleExport('csv')}>
                  CSV (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLocked}>
                  <Download />
                  Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void handleImport('json')}>
                  JSON backup
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleImport('csv')}>
                  CSV (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openAddDialog} disabled={isLocked}>
              <UserPlus />
              Add
            </Button>
            <ChangePinDialog />
            <Button
              variant={isLocked ? 'destructive' : 'default'}
              onClick={() => setLockOpen(true)}
            >
              {isLocked ? <Lock /> : <LockOpen />}
              {isLocked ? 'Unlock' : 'Lock'}
            </Button>
          </div>
        </header>

        {isLocked && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <ShieldAlert className="size-4 shrink-0" />
            App is locked. Add, Edit, Delete and Import are disabled; Export and viewing remain
            available.
          </div>
        )}

        <EmployeeTable
          employees={store.employees}
          total={store.total}
          page={store.page}
          pageCount={store.pageCount}
          limit={store.limit}
          search={store.search}
          department={store.department}
          departments={store.departments}
          isLocked={isLocked}
          onSearchChange={store.setSearch}
          onDepartmentChange={store.setDepartment}
          onLimitChange={store.setLimit}
          onPageChange={store.setPage}
          onEdit={openEditDialog}
          onDelete={setDeleteTarget}
        />
      </div>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing ?? undefined}
        onSave={editing ? (values) => store.updateEmployee(editing.id, values) : store.addEmployee}
      />
      {deleteTarget && (
        <DeleteEmployeeDialog
          employee={deleteTarget}
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onDelete={store.deleteEmployee}
        />
      )}
      {csvErrors && (
        <CsvImportErrorsDialog
          open
          onOpenChange={(open) => {
            if (!open) setCsvErrors(null)
          }}
          errors={csvErrors}
        />
      )}
      {lockOpen && (
        <LockDialog
          mode={isLocked ? 'unlock' : 'lock'}
          open
          onOpenChange={(open) => {
            if (!open) setLockOpen(false)
          }}
          onConfirm={store.toggleLock}
        />
      )}
      <Toaster />
    </div>
  )
}
