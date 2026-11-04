import type { CounterWithTotal } from './api';

import { appAlert } from '@/components/AppDialog';

/** Texto del aviso antes de borrar: depende de si son privados o de grupo. */
export function deleteMessage(counters: Pick<CounterWithTotal, 'name' | 'group'>[]): string {
  const names = counters.map((c) => `«${c.name}»`).join(', ');
  const hasGroup = counters.some((c) => c.group !== null);
  const hasPrivate = counters.some((c) => c.group === null);
  const parts = [
    `Vas a borrar ${names}.`,
    hasPrivate ? 'Los contadores individuales se borran con todos sus registros.' : null,
    hasGroup
      ? 'Los de grupo desaparecen del grupo para todos; cada miembro conserva sus registros en un contador propio.'
      : null,
    'Esta acción no se puede deshacer.',
  ];
  return parts.filter(Boolean).join('\n\n');
}

/** Pide confirmación (acción permanente) y, si se acepta, llama a `onConfirm`. */
export function confirmDeleteCounters(
  counters: Pick<CounterWithTotal, 'name' | 'group'>[],
  onConfirm: () => void,
) {
  appAlert(
    counters.length === 1 ? 'Borrar contador' : `Borrar ${counters.length} contadores`,
    deleteMessage(counters),
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: onConfirm },
    ],
  );
}
