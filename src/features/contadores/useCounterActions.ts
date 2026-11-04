import { Alert } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

import type { CounterWithTotal, EntryInput } from './api';
import { useAddEntry, useRemoveOne, useRequestCommonChange } from './hooks';

function showError(error: unknown) {
  Alert.alert('No se ha podido guardar', getErrorMessage(error));
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
    Alert.alert(
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
                  Alert.alert('Solicitud enviada', 'Te avisaremos cuando la responda.');
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
    addEntry.mutate({ counterId: counter.id, input }, { onSuccess, onError: showError });
  }

  function subtractOne(counter: CounterWithTotal) {
    if (needsRequest(counter)) {
      askAdmin(counter, -1);
      return;
    }
    removeOne.mutate(counter.id, { onError: showError });
  }

  return { add, subtractOne, saving: addEntry.isPending };
}
