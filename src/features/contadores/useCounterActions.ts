import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { appAlert } from '@/components/AppDialog';
import { useUserId } from '@/features/auth/AuthProvider';
import { getSettings } from '@/features/configuracion/settings';
import { markActiveToday } from '@/features/configuracion/reminder';
import { markTodayActive } from '@/features/estadisticas/streakCelebration';
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
  const queryClient = useQueryClient();
  const userId = useUserId();

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
      { counterId: counter.id, input, common: counter.is_common },
      {
        // Hoy ya hay registro: el recordatorio de la racha de hoy sobra.
        onSuccess: () => markActiveToday(),
        onError: showError,
      },
    );
    // Primer registro de hoy: la racha sube y la barra de pestañas lo celebra.
    markTodayActive(queryClient, userId);
    // La suma ya se ve (optimista): la ventana de «Otra cantidad» se cierra al instante, sin
    // esperar al servidor.
    onSuccess?.();
  }

  function doSubtract(counter: CounterWithTotal) {
    tap();
    removeOne.mutate(
      { counterId: counter.id, common: counter.is_common },
      {
        onSuccess: () => markActiveToday(),
        onError: showError,
      },
    );
    // El −1 también mantiene la racha, pero solo si de verdad resta (nunca baja de 0).
    if (!counter.is_common && counter.myGroupTotal >= 1) markTodayActive(queryClient, userId);
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
