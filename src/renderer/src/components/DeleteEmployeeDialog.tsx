import { useState, type JSX } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import type { Employee, IpcResult } from '@shared/employee'

interface DeleteEmployeeDialogProps {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: number) => Promise<IpcResult<null>>
}

export function DeleteEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onDelete
}: DeleteEmployeeDialogProps): JSX.Element {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (): Promise<void> => {
    setDeleting(true)
    const res = await onDelete(employee.id)
    setDeleting(false)
    if (res.success) {
      toast.success(`Deleted ${employee.name}.`)
      onOpenChange(false)
    } else {
      toast.error(res.message)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete employee?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <span className="font-medium">{employee.name}</span>. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              void handleDelete()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
