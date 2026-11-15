'use client';

import { useCallback, useState } from 'react';
import type { ActionState } from '@/app/actions';
import { ActionButton } from './forms';
import { WishCard, type WishView } from './WishCard';
import { WishItemForm } from './WishItemForm';

export function MyItem({
  item,
  maxAmount,
  updateAction,
  deleteAction,
}: {
  item: WishView;
  maxAmount: number;
  updateAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  deleteAction: () => Promise<ActionState>;
}) {
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  if (editing) {
    return (
      <div className="rounded-2xl border-2 border-rosa/40 bg-superficie p-4 sm:p-5">
        <WishItemForm action={updateAction} item={item} maxAmount={maxAmount} onDone={close} submitLabel="Guardar cambios" />
      </div>
    );
  }
  return (
    <WishCard item={item} maxAmount={maxAmount}>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
          Editar
        </button>
        <ActionButton action={deleteAction} className="btn-ghost text-peligro" confirm={`¿Quitar "${item.title}" de tu lista?`} pendingText="Quitando…">
          Quitar
        </ActionButton>
      </div>
    </WishCard>
  );
}
