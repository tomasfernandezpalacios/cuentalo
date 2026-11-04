import * as Haptics from 'expo-haptics';

import { appAlert } from '@/components/AppDialog';
import { getSettings } from '@/features/configuracion/settings';
import { markActiveToday } from '@/features/configuracion/reminder';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

import type { CounterWithTotal, EntryInput } from './api';
import { useAddEntry, useRemoveOne, useRequestCommonChange } from './hooks';

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
    addEntry.mutate(
      { counterId: counter.id, input },
      {
        onSuccess: () => {
          // Hoy ya hay registro: el recordatorio de la racha de hoy sobra.
          markActiveToday();
          onSuccess?.();
        },
        onError: showError,
      },
    );
  }

  function doSubtract(counter: CounterWithTotal) {
    tap();
    removeOne.mutate(counter.id, { onSuccess: markActiveToday, onError: showError });
  }

  function subtractOne(counter: CounterWithTotal) {
    if (needsRequest(counter)) {
      askAdmin(counter, -1);
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
