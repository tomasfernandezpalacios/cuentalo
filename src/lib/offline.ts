import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import {
  addToCommonCounter,
  createEntry,
  removeOne,
  removeOneFromCommonCounter,
  type EntryInput,
} from '@/features/contadores/api';
import { refreshAll } from '@/lib/queryClient';

// Sin conexión (petición del usuario: «que el +1 se guarde en el móvil y se envíe al volver»).
//
// * TanStack Query sabe si hay internet gracias a NetInfo (onlineManager). Sin conexión, los +N
//   y −1 no fallan: se quedan en pausa (el número ya se ve sumado, es optimista) y se envían
//   solos al volver la conexión.
// * Los que quedan en pausa se guardan en el móvil (AsyncStorage): si se cierra la app sin
//   conexión, se envían la próxima vez que se abra con internet.
// * Para poder reanudarlos tras cerrar la app, la función de cada tipo se registra por su clave
//   (setMutationDefaults): lo guardado es solo «qué» (contador, cantidad, fecha), no código.
// * Solo se guardan y esperan a la conexión los +N y −1. El resto de cambios (borrar, ocultar,
//   carpetas…) no se pueden reanudar tras cerrar la app: sin conexión fallan al momento con un
//   aviso y se deshacen (networkMode 'always' en src/lib/queryClient.ts), en vez de perderse
//   en silencio al reiniciar.

export const entryAddKey = ['entry-change', 'add'] as const;
export const entryRemoveKey = ['entry-change', 'remove'] as const;
/** Los +N y −1 se envían de uno en uno y en el orden en que se tocaron. */
export const entryScope = { id: 'entry-change' };

/** ¿Es un +N o −1 (lo único que se guarda en el móvil para enviarlo más tarde)? */
export function isEntryChange(mutationKey: readonly unknown[] | undefined): boolean {
  return mutationKey?.[0] === entryAddKey[0];
}

export type AddEntryVariables = { counterId: string; input: EntryInput; common: boolean };
export type RemoveOneVariables = { counterId: string; common: boolean };

/** Envía un +N. La fecha es la del toque (guardada al tocar, aunque se envíe más tarde). */
export async function sendAddEntry({ counterId, input, common }: AddEntryVariables) {
  // Al volver de lo guardado en el móvil, la fecha llega como texto.
  const entry = { ...input, loggedAt: new Date(input.loggedAt) };
  if (common) await addToCommonCounter(counterId, entry);
  else await createEntry(counterId, entry);
}

/** Envía un −1. */
export async function sendRemoveOne({ counterId, common }: RemoveOneVariables) {
  if (common) await removeOneFromCommonCounter(counterId);
  else await removeOne(counterId);
}

/** Conecta TanStack Query con el estado de la conexión y registra los envíos reanudables. */
export function setupOffline(client: QueryClient) {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // isInternetReachable puede tardar en saberse (null): mientras, vale con estar conectado.
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    }),
  );
  // Para los que se reanudan al abrir la app (sin la pantalla que los lanzó): en orden, esperando
  // a la conexión, y al acabar se refresca lo que cambia.
  const common = {
    scope: entryScope,
    networkMode: 'online' as const,
    onSettled: () => refreshAll(client),
  };
  client.setMutationDefaults(entryAddKey, { ...common, mutationFn: sendAddEntry });
  client.setMutationDefaults(entryRemoveKey, { ...common, mutationFn: sendRemoveOne });
}

/** Dónde se guardan en el móvil los cambios pendientes de enviar. */
export const offlinePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'cuentalo.pendientes',
});

/** ¿Hay conexión ahora? (para avisar de que los cambios se enviarán al volver). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
}
