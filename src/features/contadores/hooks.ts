import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';

import {
  createCounter,
  deleteCounter,
  deleteEntry,
  fetchCounter,
  fetchCounters,
  fetchEntries,
  fetchGroupCounterDaily,
  fetchLeaderboard,
  fetchStreakLeaderboard,
  fetchMyLastCounterId,
  mergeCounters,
  requestCommonChange,
  setHidden,
  setRemovedFromHome,
  setParticipants,
  updateCounter,
  updateEntry,
  type CounterInput,
  type CounterWithTotal,
  type Entry,
  type EntryInput,
  type LeaderboardPeriod,
} from './api';
import { optimistic, optimisticHandlers, refreshAll, type Undo } from '@/lib/queryClient';

import {
  entryAddKey,
  entryRemoveKey,
  entryScope,
  sendAddEntry,
  sendRemoveOne,
  type AddEntryVariables,
  type RemoveOneVariables,
} from '@/lib/offline';
import { localToday, type DailyTotal } from '@/features/estadisticas/periods';

import { applyCounterPhoto, type CounterPhotoChange } from './photos';

export const counterKeys = {
  all: ['counters'] as const,
  list: () => [...counterKeys.all, 'list'] as const,
  detail: (id: string) => [...counterKeys.all, 'detail', id] as const,
  entries: (id: string) => [...counterKeys.all, 'entries', id] as const,
  leaderboard: (id: string, period: LeaderboardPeriod) =>
    [...counterKeys.all, 'leaderboard', id, period] as const,
  lastUsed: (ids: string[]) => [...counterKeys.all, 'last-used', ...ids] as const,
  dailyTotals: (userId: string) => [...counterKeys.all, 'daily-totals', userId] as const,
};

// Tras cualquier cambio refrescamos todo (no solo lo de contadores): son pocas consultas y así
// la lista, el detalle, la clasificación, las estadísticas, las rachas de amigos, los perfiles y
// el buzón se ven al instante y nunca se desincronizan. Solo se vuelven a pedir las que están
// en pantalla; el resto se marca como antiguo y se pide al abrirlas.
function invalidateCounters(queryClient: QueryClient) {
  return refreshAll(queryClient);
}

/**
 * Cambia al momento los contadores `ids` en la lista y en su detalle (`patch` devuelve el
 * contador cambiado, o null para quitarlo de la lista). Devuelve cómo deshacerlo.
 */
async function patchCounters(
  queryClient: QueryClient,
  ids: string[],
  patch: (counter: CounterWithTotal) => CounterWithTotal | null,
): Promise<Undo[]> {
  const set = new Set(ids);
  const undoList = await optimistic<CounterWithTotal[]>(queryClient, counterKeys.list(), (list) =>
    list.flatMap((c) => {
      if (!set.has(c.id)) return [c];
      const next = patch(c);
      return next ? [next] : [];
    }),
  );
  const undoDetails = await Promise.all(
    ids.map((id) =>
      optimistic<CounterWithTotal>(queryClient, counterKeys.detail(id), (c) => patch(c) ?? c),
    ),
  );
  return [undoList, ...undoDetails];
}

// --- Consultas --------------------------------------------------------------

/** Todos los contadores que veo; la lista de inicio filtra los `isActive`. */
export function useCounterList() {
  const userId = useUserId();
  return useQuery({
    queryKey: counterKeys.list(),
    queryFn: () => fetchCounters(userId),
    enabled: userId !== '',
  });
}

export function useCounter(id: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: counterKeys.detail(id),
    // El detalle sale de la misma carga que la lista (si está reciente, sin pedir nada; si se
    // están pidiendo las dos a la vez, una sola petición). Solo si no está en la lista (p. ej.
    // un contador de un grupo que dejé) se pide aparte.
    queryFn: async () => {
      const all = await queryClient.fetchQuery({
        queryKey: counterKeys.list(),
        queryFn: () => fetchCounters(userId),
        staleTime: 2_000,
      });
      return fetchCounter(id, userId, all);
    },
    enabled: userId !== '',
  });
}

/** Mi historial del contador; `counterIds` incluye sus enlazados (si los tiene). */
export function useEntries(counterId: string, counterIds: string[] | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...counterKeys.entries(counterId), ...(counterIds ?? [])],
    queryFn: () => fetchEntries(counterIds ?? [counterId], userId),
    enabled: userId !== '' && counterIds !== undefined,
    placeholderData: keepPreviousData,
  });
}

/** Totales diarios por miembro de un contador de grupo (gráfica del grupo). */
export function useGroupCounterDaily(counterId: string) {
  return useQuery({
    // Cuelga de la clasificación: se refresca igual al registrar.
    queryKey: [...counterKeys.leaderboard(counterId, 'all'), 'daily'],
    queryFn: () => fetchGroupCounterDaily(counterId),
    placeholderData: keepPreviousData,
  });
}

export function useStreakLeaderboard(counterId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...counterKeys.leaderboard(counterId, 'all'), 'streak'],
    queryFn: () => fetchStreakLeaderboard(counterId),
    enabled,
  });
}

export function useLeaderboard(counterId: string, period: LeaderboardPeriod, enabled: boolean) {
  return useQuery({
    queryKey: counterKeys.leaderboard(counterId, period),
    queryFn: () => fetchLeaderboard(counterId, period),
    enabled,
    // Al cambiar de periodo se sigue viendo el anterior hasta que llega el nuevo (sin parpadeo).
    placeholderData: keepPreviousData,
  });
}

export function useMyLastCounterId(counterIds: string[]) {
  const userId = useUserId();
  return useQuery({
    queryKey: counterKeys.lastUsed(counterIds),
    queryFn: () => fetchMyLastCounterId(counterIds, userId),
    enabled: userId !== '' && counterIds.length > 0,
    placeholderData: keepPreviousData,
  });
}

// --- Contadores -------------------------------------------------------------

type CreateCounterVariables = {
  input: CounterInput;
  groupId: string | null;
  /** Participantes si es un contador común; null si no. */
  participantIds: string[] | null;
};

export function useCreateCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, groupId, participantIds }: CreateCounterVariables) =>
      createCounter(input, groupId, participantIds),
    onSuccess: () => invalidateCounters(queryClient),
  });
}

export function useMergeCounters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      name,
      emoji,
      photo,
      currentPhoto = null,
    }: {
      ids: string[];
      name: string;
      emoji: string;
      /** Foto del contador resultante (solo individuales): nueva, quitarla o dejarla. */
      photo?: CounterPhotoChange;
      currentPhoto?: string | null;
    }) => {
      const id = await mergeCounters(ids, name, emoji);
      if (photo) await applyCounterPhoto(id, currentPhoto, photo);
      return id;
    },
    // Cambian contadores y carpetas: refrescamos todo.
    onSuccess: () => refreshAll(queryClient),
  });
}

export function useSetParticipants(counterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => setParticipants(counterId, userIds),
    onSuccess: () => invalidateCounters(queryClient),
  });
}

export function useUpdateCounter(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CounterInput>) => updateCounter(id, patch),
    // El nombre, la unidad y el emoticono nuevos se ven al instante en la lista y el detalle.
    ...optimisticHandlers(queryClient, (patch: Partial<CounterInput>) =>
      patchCounters(queryClient, [id], (c) => {
        // Con un alias personal, lo que veo es el alias: solo cambia el nombre compartido.
        const hasAliasName = c.name !== c.sharedName;
        const hasAliasEmoji = c.emoji !== c.sharedEmoji;
        const name = patch.name?.trim();
        const emoji = patch.emoji === undefined ? undefined : patch.emoji.trim() || null;
        return {
          ...c,
          ...(name ? { sharedName: name, name: hasAliasName ? c.name : name } : {}),
          ...(emoji !== undefined
            ? { sharedEmoji: emoji, emoji: hasAliasEmoji ? c.emoji : emoji }
            : {}),
          ...(patch.unit !== undefined ? { unit: patch.unit.trim() || null } : {}),
          ...(patch.streakEnabled !== undefined ? { streak_enabled: patch.streakEnabled } : {}),
          ...(patch.hiddenFromFriends !== undefined
            ? { hidden_from_friends: patch.hiddenFromFriends }
            : {}),
        };
      }),
    ),
  });
}

/** Borra uno o varios contadores (los de grupo solo salen del grupo, ver deleteCounter). */
export function useDeleteCounters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (counters: Pick<CounterWithTotal, 'id' | 'group_id'>[]) => {
      for (const counter of counters) await deleteCounter(counter);
    },
    // Desaparecen de la lista al instante; si falla, vuelven.
    onMutate: async (counters: Pick<CounterWithTotal, 'id' | 'group_id'>[]) => ({
      undo: [
        await optimistic<CounterWithTotal[]>(queryClient, counterKeys.list(), (list) =>
          list.filter((c) => !counters.some((d) => d.id === c.id)),
        ),
      ],
    }),
    onError: (_error, _counters, context) => context?.undo.forEach((undo) => undo()),
    onSuccess: (_result, counters) => {
      for (const c of counters) queryClient.removeQueries({ queryKey: counterKeys.detail(c.id) });
    },
    // También cambian carpetas y estadísticas: por detrás.
    onSettled: () => refreshAll(queryClient),
  });
}

export function useSetHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, hidden }: { ids: string[]; hidden: boolean }) => setHidden(ids, hidden),
    ...optimisticHandlers(queryClient, ({ ids, hidden }: { ids: string[]; hidden: boolean }) =>
      patchCounters(queryClient, ids, (c) => ({ ...c, hidden })),
    ),
  });
}

export function useSetRemovedFromHome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, removed }: { ids: string[]; removed: boolean }) =>
      setRemovedFromHome(ids, removed),
    ...optimisticHandlers(queryClient, ({ ids, removed }: { ids: string[]; removed: boolean }) =>
      patchCounters(queryClient, ids, (c) => ({ ...c, removedFromHome: removed })),
    ),
  });
}

export function useRequestCommonChange() {
  return useMutation({
    mutationFn: ({ counterId, amount }: { counterId: string; amount: number }) =>
      requestCommonChange(counterId, amount),
  });
}

// --- Registros --------------------------------------------------------------

type TotalChange = (counter: CounterWithTotal) => CounterWithTotal;

/**
 * Aplica un cambio al total de un contador en la caché (lista y detalle) antes de que responda
 * el servidor, y devuelve lo necesario para deshacerlo si falla. Así los botones se sienten
 * inmediatos.
 */
async function applyOptimistic(
  queryClient: QueryClient,
  userId: string,
  counterId: string,
  change: TotalChange,
) {
  const detailKey = counterKeys.detail(counterId);
  const listKey = counterKeys.list();
  const dailyKey = counterKeys.dailyTotals(userId);
  await queryClient.cancelQueries({ queryKey: counterKeys.all });

  const previousDetail = queryClient.getQueryData<CounterWithTotal>(detailKey);
  const previousList = queryClient.getQueryData<CounterWithTotal[]>(listKey);
  const previousDaily = queryClient.getQueryData<DailyTotal[]>(dailyKey);
  const before = previousDetail ?? previousList?.find((c) => c.id === counterId);
  if (previousDetail) queryClient.setQueryData(detailKey, change(previousDetail));
  if (previousList) {
    queryClient.setQueryData(
      listKey,
      previousList.map((c) => (c.id === counterId ? change(c) : c)),
    );
  }
  // Las estadísticas también se ven al instante: lo que cambia «lo mío» se suma al día de hoy.
  const mine = before ? change(before).myTotal - before.myTotal : 0;
  if (previousDaily && mine !== 0) {
    queryClient.setQueryData(dailyKey, addToDay(previousDaily, counterId, localToday(), mine));
  }
  return { detailKey, listKey, dailyKey, previousDetail, previousList, previousDaily };
}

/** Suma `amount` al total del día `day` del contador (o crea ese día). */
function addToDay(rows: DailyTotal[], counterId: string, day: string, amount: number) {
  const index = rows.findIndex((r) => r.counterId === counterId && r.day === day);
  const entries = amount > 0 ? 1 : 0;
  if (index === -1) return [...rows, { counterId, day, total: amount, entryCount: entries }];
  return rows.map((r, i) =>
    i === index ? { ...r, total: r.total + amount, entryCount: r.entryCount + entries } : r,
  );
}

type OptimisticContext = Awaited<ReturnType<typeof applyOptimistic>>;

/**
 * Cuánto cambia el total visible y el mío al sumar `amount`. En un contador común se apunta a
 * cada participante, pero el total del grupo («entre todos») cuenta cada suma una sola vez.
 */
function applyAmount(c: CounterWithTotal, amount: number, userId: string): CounterWithTotal {
  if (!c.is_common) {
    return {
      ...c,
      total: c.total + amount,
      myTotal: c.myTotal + amount,
      myGroupTotal: c.myGroupTotal + amount,
      displayTotal: c.displayTotal + amount,
      entryCount: c.entryCount + (amount > 0 ? 1 : 0),
      myEntryCount: c.myEntryCount + (amount > 0 ? 1 : 0),
    };
  }
  const iParticipate = c.participantIds.includes(userId);
  return {
    ...c,
    total: c.total + amount,
    myTotal: c.myTotal + (iParticipate ? amount : 0),
    myGroupTotal: c.myGroupTotal + (iParticipate ? amount : 0),
    displayTotal: c.displayTotal + amount,
    entryCount: c.entryCount + (amount > 0 ? 1 : 0),
    myEntryCount: c.myEntryCount + (amount > 0 && iParticipate ? 1 : 0),
  };
}

function rollback(queryClient: QueryClient, context: OptimisticContext | undefined) {
  if (!context) return;
  queryClient.setQueryData(context.detailKey, context.previousDetail);
  queryClient.setQueryData(context.listKey, context.previousList);
  queryClient.setQueryData(context.dailyKey, context.previousDaily);
}

// --- Refresco tras +N / −1 ---------------------------------------------------
//
// Cada toque ya se ve al momento (optimista) en la lista, el detalle y las estadísticas. Al
// terminar una ráfaga de toques solo se vuelve a pedir lo que el servidor calcula y se está
// viendo: la lista de contadores (totales exactos), el historial y la clasificación. Lo demás
// (estadísticas, rachas, avisos…) solo se marca como antiguo: se pide al volver a la app o al
// tirar para refrescar, en vez de descargar todo después de cada toque.
//  - Todos los +N/−1 comparten `entryMutationKey`, así sabemos si queda alguno en vuelo.
//  - Solo el último en terminar programa el refresco, con un pequeño retraso que se reinicia con
//    cada toque nuevo (varios toques rápidos → un solo refresco al final). Así una respuesta con
//    el total antiguo no pisa un toque que aún no se ha guardado.

const entryMutationKey = ['entry-change'] as const;
const REFRESH_DELAY_MS = 700;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

/** Lo que cambia con un +N/−1: se vuelve a pedir solo lo que está en pantalla. */
export function refreshAfterEntries(queryClient: QueryClient) {
  const live = (part: string) => ({ queryKey: [...counterKeys.all, part] });
  void queryClient.invalidateQueries(live('list'));
  void queryClient.invalidateQueries(live('detail'));
  void queryClient.invalidateQueries(live('entries'));
  void queryClient.invalidateQueries(live('leaderboard'));
  // El resto de lo que cuelga de los contadores, sin pedirlo ahora.
  void queryClient.invalidateQueries({ queryKey: counterKeys.all, refetchType: 'none' });
  void queryClient.invalidateQueries({ queryKey: ['social'], refetchType: 'none' });
}

/** Llamar en `onSettled`: la mutación que termina aún cuenta como en vuelo. */
function scheduleRefreshAfterEntry(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: entryMutationKey }) > 1) return;
  cancelScheduledRefresh();
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (queryClient.isMutating({ mutationKey: entryMutationKey }) > 0) return;
    refreshAfterEntries(queryClient);
  }, REFRESH_DELAY_MS);
}

/**
 * +N. En un contador común se suma a todos sus participantes. Sin conexión no falla: se queda
 * en pausa (ya se ve sumado) y se envía al volver (ver src/lib/offline.ts). Los +N y −1 se
 * envían de uno en uno y en orden (`entryScope`): un −1 nunca llega antes que el +1 anterior.
 */
export function useAddEntry() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationKey: entryAddKey,
    scope: entryScope,
    mutationFn: sendAddEntry,
    onMutate: ({ counterId, input }: AddEntryVariables) => {
      cancelScheduledRefresh();
      return applyOptimistic(queryClient, userId, counterId, (c) =>
        applyAmount(c, input.amount, userId),
      );
    },
    onError: (_error, _variables, context) => rollback(queryClient, context),
    onSettled: () => scheduleRefreshAfterEntry(queryClient),
  });
}

/**
 * Botón −1: guarda un registro de −1 (nunca baja de 0) que no cuenta como registro. En un
 * contador común resta a todos los participantes. El servidor corrige los totales exactos.
 */
export function useRemoveOne() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationKey: entryRemoveKey,
    scope: entryScope,
    mutationFn: sendRemoveOne,
    onMutate: ({ counterId }: RemoveOneVariables) => {
      cancelScheduledRefresh();
      return applyOptimistic(queryClient, userId, counterId, (c) =>
        c.is_common
          ? applyAmount(c, -1, userId)
          : c.myGroupTotal < 1
            ? c
            : applyAmount(c, -1, userId),
      );
    },
    onError: (_error, _variables, context) => rollback(queryClient, context),
    onSettled: () => scheduleRefreshAfterEntry(queryClient),
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entry, input }: { entry: Entry; input: EntryInput }) =>
      updateEntry(entry, input),
    onSuccess: () => invalidateCounters(queryClient),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: Entry) => deleteEntry(entry),
    onSuccess: () => invalidateCounters(queryClient),
  });
}
