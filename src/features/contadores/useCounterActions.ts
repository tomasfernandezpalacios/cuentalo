import * as Haptics from 'expo-haptics';

import { appAlert } from '@/components/AppDialog';
import { showUndoToast } from '@/components/UndoToast';
import { getSettings } from '@/features/configuracion/settings';
import { markActiveToday } from '@/features/configuracion/reminder';
import { tutorialEvent } from '@/features/tutorial/store';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

import type { CounterWithTotal, EntryInput } from './api';
import { useAddEntry, useRemoveOne, useRequestCommonChange, useUndoLastEntry } from './hooks';

function showError(error: unknown) {
  appAlert('No se ha podido guardar', getErrorMessage(error));
}

/** Vibración suave al registrar, si está activada en Configuración. */
function tap() {
  if (getSettings().haptics) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * +N y −1 desde cualquier pantalla. En un contador común del que no soy administrador, en vez
 * de registrar se ofrece enviarle una solicitud (él la acepta o la rechaza en su buzón).
 */
export function useCounterActions() {
  const addEntry = useAddEntry();
  const removeOne = useRemoveOne();
  const request = useRequestCommonChange();
  const undo = useUndoLastEntry();

  /** Aviso «+1 en Cafés · Deshacer» tras registrar (borra lo que se acaba de apuntar). */
  function offerUndo(counter: CounterWithTotal, text: string) {
    showUndoToast(`${text} en «${counter.name}»`, () =>
      undo.mutate(counter.id, {
        onSuccess: (done) => {
          if (!done) appAlert('No se ha podido deshacer', 'Ese registro ya no se puede deshacer.');
        },
        onError: showError,
      }),
    );
  }

  function askAdmin(counter: CounterWithTotal, amount: number, onSent?: () => void) {
    const change = amount > 0 ? `sumar ${formatAmount(amount)}` : `restar ${formatAmount(-amount)}`;
    appAlert(
      'Solicitar al administrador',
      `«${counter.name}» es un contador común y solo su administrador puede cambiarlo. ` +
        `¿Quieres pedirle que lo haga (${change} a todos)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar solicitud',
          onPress: () =>
            request.mutate(
              { counterId: counter.id, amount },
              {
                onSuccess: () => {
                  // Si el tutorial está en «Suma con un toque», enviar la solicitud también vale.
                  tutorialEvent('entry-added');
                  appAlert('Solicitud enviada', 'Te avisaremos cuando la responda.');
                  onSent?.();
                },
                onError: showError,
              },
            ),
        },
      ],
    );
  }

  const needsRequest = (counter: CounterWithTotal) => counter.is_common && !counter.canManage;

  function add(counter: CounterWithTotal, input: EntryInput, onSuccess?: () => void) {
    if (needsRequest(counter)) {
      askAdmin(counter, input.amount, onSuccess);
      return;
    }
    tap();
    // Paso «Suma con un toque» del tutorial (si está en marcha).
    tutorialEvent('entry-added');
    addEntry.mutate(
      { counterId: counter.id, input },
      {
        onSuccess: () => {
          // Hoy ya hay registro: el recordatorio de la racha de hoy sobra.
          markActiveToday();
          offerUndo(counter, `+${formatAmount(input.amount)}`);
          onSuccess?.();
        },
        onError: showError,
      },
    );
  }

  function doSubtract(counter: CounterWithTotal) {
    tap();
    // Paso «Resta 1» del tutorial (si está en marcha).
    tutorialEvent('entry-removed');
    removeOne.mutate(counter.id, {
      onSuccess: () => {
        markActiveToday();
        offerUndo(counter, '−1');
      },
      onError: showError,
    });
  }

  function subtractOne(counter: CounterWithTotal) {
    if (needsRequest(counter)) {
      askAdmin(counter, -1);
      return;
    }
    // Contador de racha: si hoy ya está mantenida y el −1 la dejaría por debajo de +1, se avisa.
    const streak = counter.streak;
    if (streak && streak.todayDone && streak.todayAmount - 1 < 1) {
      appAlert(
        'Perderías la racha',
        `Hoy quedarías por debajo de +1 en «${counter.name}» y perderías tu racha de ` +
          `${streak.current} ${streak.current === 1 ? 'día' : 'días'}. ¿Restar igualmente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Restar', style: 'destructive', onPress: () => doSubtract(counter) },
        ],
      );
      return;
    }
    if (getSettings().confirmRemove) {
      appAlert('Restar 1', `¿Quieres restar 1 en «${counter.name}»?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restar', onPress: () => doSubtract(counter) },
      ]);
      return;
    }
    doSubtract(counter);
  }

  return { add, subtractOne, saving: addEntry.isPending };
}
