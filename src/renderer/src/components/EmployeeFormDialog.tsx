import { useEffect, type JSX } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { z } from 'zod'
import {
  employeeInputSchema,
  type Employee,
  type EmployeeInput,
  type IpcResult
} from '@shared/employee'

const employeeFormSchema = employeeInputSchema.extend({
  salary: z.number('Salary must be a number').nonnegative('Salary must be ≥ 0')
})

type EmployeeFormValues = z.input<typeof employeeFormSchema>

const EMPTY_INPUT: EmployeeFormValues = {
  name: '',
  position: '',
  department: '',
  phone: '',
  joinedDate: '',
  salary: 0
}

interface EmployeeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee
  onSave: (input: EmployeeInput) => Promise<IpcResult<Employee>>
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSave
}: EmployeeFormDialogProps): JSX.Element {
  const form = useForm<EmployeeFormValues, unknown, EmployeeInput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee ?? EMPTY_INPUT
  })

  useEffect(() => {
    if (open) form.reset(employee ?? EMPTY_INPUT)
  }, [open, employee, form])

  const onSubmit = async (values: EmployeeInput): Promise<void> => {
    const res = await onSave(values)
    if (res.success) {
      toast.success(employee ? 'Employee updated.' : 'Employee added.')
      onOpenChange(false)
    } else {
      toast.error(res.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
          <DialogDescription>
            {employee ? 'Update the details and save.' : 'Fill in the details of the new employee.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <FormControl>
                    <Input placeholder="Software Engineer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input placeholder="Engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555 0100" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>Optional.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="joinedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joined date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={Number.isFinite(field.value) ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {employee ? 'Save changes' : 'Add employee'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
