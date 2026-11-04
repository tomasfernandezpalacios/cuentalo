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

const names = (counters: Pick<CounterWithTotal, 'name'>[]) =>
  counters.map((c) => `«${c.name}»`).join(', ');

/** Explicación para los contadores de grupo que no puedo borrar porque no soy su administrador. */
export function removeFromHomeMessage(counters: Pick<CounterWithTotal, 'name'>[]): string {
  const one = counters.length === 1;
  return (
    `No puedes eliminar ${names(counters)} porque no eres ${one ? 'su' : 'el'} administrador. ` +
    `Lo que sí puedes es quitar${one ? 'lo' : 'los'} de tu pantalla principal: seguirás ` +
    `perteneciendo a ${one ? 'él' : 'ellos'}, contando en la clasificación del grupo y ` +
    `viéndo${one ? 'lo' : 'los'} dentro del grupo.\n\n` +
    'Se puede deshacer: entra en el contador desde el grupo y pulsa el botón de la casa, arriba ' +
    'a la derecha, para añadirlo de nuevo a tu pantalla principal.'
  );
}

/**
 * Borrar desde la selección: los que administro se borran; los de grupo que no administro solo
 * se quitan de mi pantalla principal (con su propia explicación).
 */
export function confirmDeleteOrRemove(
  toDelete: Pick<CounterWithTotal, 'name' | 'group'>[],
  toRemove: Pick<CounterWithTotal, 'name'>[],
  onConfirm: () => void,
) {
  if (toRemove.length === 0) {
    confirmDeleteCounters(toDelete, onConfirm);
    return;
  }
  if (toDelete.length === 0) {
    appAlert('Quitar de tu pantalla principal', removeFromHomeMessage(toRemove), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar de mi pantalla', onPress: onConfirm },
    ]);
    return;
  }
  appAlert(
    'Borrar contadores',
    `${deleteMessage(toDelete)}\n\n${removeFromHomeMessage(toRemove)}`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Continuar', style: 'destructive', onPress: onConfirm },
    ],
  );
}
