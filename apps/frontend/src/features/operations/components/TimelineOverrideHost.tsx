import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTimelineOverrideRequest } from '../lib/timeline-override';

const MIN_REASON = 3;

function OverrideForm({
  message,
  onResolve,
}: {
  message: string;
  onResolve: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= MIN_REASON;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Horário fora do cronograma da noiva</DialogTitle>
        <DialogDescription className="text-warning-700" data-testid="override-message">
          {message}
        </DialogDescription>
      </DialogHeader>
      <div>
        <Label htmlFor="timeline-override-reason">Motivo</Label>
        <Textarea
          id="timeline-override-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby="timeline-override-hint"
          className="mt-xs"
        />
        <p id="timeline-override-hint" className="mt-xs text-neutral-500">
          Fica registrado quem forçou e quando.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onResolve(null)}>
          Cancelar
        </Button>
        <Button type="button" disabled={!valid} onClick={() => onResolve(reason.trim())}>
          Forçar mesmo assim
        </Button>
      </DialogFooter>
    </>
  );
}

/** Diálogo único de confirmação do override de cronograma, montado no App. */
export function TimelineOverrideHost() {
  const request = useTimelineOverrideRequest();
  return (
    <Dialog open={request != null} onOpenChange={(open) => !open && request?.resolve(null)}>
      <DialogContent>
        {request && (
          <OverrideForm
            key={request.message}
            message={request.message}
            onResolve={(r) => request.resolve(r)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
