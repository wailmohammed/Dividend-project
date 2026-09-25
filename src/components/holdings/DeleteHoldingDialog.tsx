import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface DeleteHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdingSymbol: string;
  holdingName?: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteHoldingDialog: React.FC<DeleteHoldingDialogProps> = ({
  open,
  onOpenChange,
  holdingSymbol,
  holdingName,
  onConfirm,
  isDeleting = false,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Remove Holding
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{holdingSymbol}</strong>
            {holdingName && ` (${holdingName})`} from your portfolio?
            <br />
            <span className="text-muted-foreground mt-2 block">
              This action cannot be undone. The holding will be permanently deleted.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Removing...' : 'Remove Holding'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
