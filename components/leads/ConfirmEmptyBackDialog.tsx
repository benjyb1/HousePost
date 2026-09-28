'use client'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Shown before sending when the user has no back design set. The back would
 * print blank (just the reserved address area), so we warn once and let them
 * either add a back first or send as is. Purely a UI gate — it does not change
 * what the send request does.
 */
export function ConfirmEmptyBackDialog({
  open,
  count,
  onSendAnyway,
  onAddBack,
  onCancel,
}: {
  open: boolean
  count: number
  onSendAnyway: () => void
  onAddBack: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send without a back design?</AlertDialogTitle>
          <AlertDialogDescription>
            You haven&apos;t set a design for the back of your postcard, so {count === 1 ? 'it' : `all ${count}`} will print
            with a blank back — just the address area on the right. You can add a back design first, or send as is.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onAddBack}>
            Add a back design
          </Button>
          <AlertDialogAction onClick={onSendAnyway}>Send anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
