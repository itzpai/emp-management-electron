import { useState, type JSX } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { pinSchema } from '@shared/employee'

const changePinFormSchema = z
  .object({ currentPin: pinSchema, newPin: pinSchema, confirmPin: z.string() })
  .refine((v) => v.newPin === v.confirmPin, { path: ['confirmPin'], message: 'PINs do not match' })

type ChangePinValues = z.infer<typeof changePinFormSchema>

export function ChangePinDialog(): JSX.Element {
  const [open, setOpen] = useState(false)
  const form = useForm<ChangePinValues>({
    resolver: zodResolver(changePinFormSchema),
    defaultValues: { currentPin: '', newPin: '', confirmPin: '' }
  })

  const onSubmit = async (values: ChangePinValues): Promise<void> => {
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
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound />
          Change PIN
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>
            Requires the current PIN. The PIN unlocks editing and locking.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {(['currentPin', 'newPin', 'confirmPin'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {name === 'currentPin'
                        ? 'Current PIN'
                        : name === 'newPin'
                          ? 'New PIN'
                          : 'Confirm new PIN'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Change PIN
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
