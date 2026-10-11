import { useState, type JSX } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IpcResult } from '@shared/employee'

interface LockDialogProps {
  mode: 'lock' | 'unlock'
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (pin: string) => Promise<IpcResult<{ isLocked: boolean }>>
}

export function LockDialog({ mode, open, onOpenChange, onConfirm }: LockDialogProps): JSX.Element {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true)
    const res = await onConfirm(pin)
    setSubmitting(false)
    if (res.success) {
      toast.success(res.data.isLocked ? 'App locked.' : 'App unlocked.')
      onOpenChange(false)
    } else {
      toast.error(res.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'lock' ? 'Lock app' : 'Unlock app'}</DialogTitle>
          <DialogDescription>
            {mode === 'lock'
              ? 'Enter your PIN to switch the app to read-only mode.'
              : 'Enter your PIN to enable editing again.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="lock-pin">PIN</Label>
            <Input
              id="lock-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || pin.length === 0}>
              {mode === 'lock' ? 'Lock' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
