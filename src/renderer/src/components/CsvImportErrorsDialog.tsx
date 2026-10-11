import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { CsvRowError } from '@shared/employee'

interface CsvImportErrorsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errors: CsvRowError[]
}

export function CsvImportErrorsDialog({
  open,
  onOpenChange,
  errors
}: CsvImportErrorsDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>CSV import failed</DialogTitle>
          <DialogDescription>
            {errors.length} issue{errors.length === 1 ? '' : 's'} found in the file — no rows were
            imported. Fix the rows below and try again.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Row</TableHead>
                <TableHead className="w-40">Field</TableHead>
                <TableHead>Problem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((error, i) => (
                <TableRow key={`${error.row}-${error.field}-${i}`}>
                  <TableCell>{error.row}</TableCell>
                  <TableCell className="font-medium">{error.field}</TableCell>
                  <TableCell>{error.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
