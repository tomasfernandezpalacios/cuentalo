import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';

import {
  addToCommonCounter,
  createCounter,
  createEntry,
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
  removeOne,
  removeOneFromCommonCounter,
  requestCommonChange,
  setHidden,
  setRemovedFromHome,
  undoLastEntry,
  setParticipants,
  updateCounter,
  updateEntry,
  type CounterInput,
  type CounterWithTotal,
  type Entry,
  type EntryInput,
  type LeaderboardPeriod,
} from './api';

export const counterKeys = {
  all: ['counters'] as const,
  list: () => [...counterKeys.all, 'list'] as const,
  detail: (id: string) => [...counterKeys.all, 'detail', id] as const,
  entries: (id: string) => [...counterKeys.all, 'entries', id] as const,
  leaderboard: (id: string, period: LeaderboardPeriod) =>
    [...counterKeys.all, 'leaderboard', id, period] as const,
  lastUsed: (ids: string[]) => [...counterKeys.all, 'last-used', ...ids] as const,
};

// Tras cualquier cambio refrescamos todo (no solo lo de contadores): son pocas consultas y así
// la lista, el detalle, la clasificación, las estadísticas, las rachas de amigos, los perfiles y
// el buzón se ven al instante y nunca se desincronizan. Solo se vuelven a pedir las que están
// en pantalla; el resto se marca como antiguo y se pide al abrirlas.
function invalidateCounters(queryClient: QueryClient) {
  return queryClient.invalidateQueries();
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
  return useQuery({
    queryKey: counterKeys.detail(id),
    queryFn: () => fetchCounter(id, userId),
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
  });
}

/** Totales diarios por miembro de un contador de grupo (gráfica del grupo). */
export function useGroupCounterDaily(counterId: string) {
  return useQuery({
    // Cuelga de la clasificación: se refresca igual al registrar.
    queryKey: [...counterKeys.leaderboard(counterId, 'all'), 'daily'],
    queryFn: () => fetchGroupCounterDaily(counterId),
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
  });
}

export function useMyLastCounterId(counterIds: string[]) {
  const userId = useUserId();
  return useQuery({
    queryKey: counterKeys.lastUsed(counterIds),
    queryFn: () => fetchMyLastCounterId(counterIds, userId),
    enabled: userId !== '' && counterIds.length > 0,
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
    mutationFn: ({ ids, name, emoji }: { ids: string[]; name: string; emoji: string }) =>
      mergeCounters(ids, name, emoji),
    // Cambian contadores y carpetas: refrescamos todo.
    onSuccess: () => queryClient.invalidateQueries(),
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
    mutationFn: (patch: Partial<CounterInput> & { archived?: boolean }) => updateCounter(id, patch),
    onSuccess: () => invalidateCounters(queryClient),
  });
}

/** Borra uno o varios contadores (los de grupo solo salen del grupo, ver deleteCounter). */
export function useDeleteCounters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (counters: Pick<CounterWithTotal, 'id' | 'group_id'>[]) => {
      for (const counter of counters) await deleteCounter(counter);
    },
    onSuccess: (_result, counters) => {
      for (const c of counters) queryClient.removeQueries({ queryKey: counterKeys.detail(c.id) });
      // También cambian carpetas y estadísticas.
      return queryClient.invalidateQueries();
    },
  });
}

export function useSetHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, hidden }: { ids: string[]; hidden: boolean }) => setHidden(ids, hidden),
    onSuccess: () => invalidateCounters(queryClient),
  });
}

/** Deshacer el último registro (desde el aviso «Deshacer»). */
export function useUndoLastEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: undoLastEntry,
    onSettled: () => invalidateCounters(queryClient),
  });
}

export function useSetRemovedFromHome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, removed }: { ids: string[]; removed: boolean }) =>
      setRemovedFromHome(ids, removed),
    onSuccess: () => invalidateCounters(queryClient),
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
async function applyOptimistic(queryClient: QueryClient, counterId: string, change: TotalChange) {
  const detailKey = counterKeys.detail(counterId);
  const listKey = counterKeys.list();
  await queryClient.cancelQueries({ queryKey: counterKeys.all });

  const previousDetail = queryClient.getQueryData<CounterWithTotal>(detailKey);
  const previousList = queryClient.getQueryData<CounterWithTotal[]>(listKey);
  if (previousDetail) queryClient.setQueryData(detailKey, change(previousDetail));
  if (previousList) {
    queryClient.setQueryData(
      listKey,
      previousList.map((c) => (c.id === counterId ? change(c) : c)),
    );
  }
  return { detailKey, listKey, previousDetail, previousList };
}

type OptimisticContext = Awaited<ReturnType<typeof applyOptimistic>>;

/** El contador tal y como está en la caché (detalle o lista), para saber si es común. */
function cachedCounter(queryClient: QueryClient, counterId: string) {
  return (
    queryClient.getQueryData<CounterWithTotal>(counterKeys.detail(counterId)) ??
    queryClient
      .getQueryData<CounterWithTotal[]>(counterKeys.list())
      ?.find((c) => c.id === counterId)
  );
}

/**
 * Cuánto cambia el total visible y el mío al sumar `amount`. En un contador común se suma a cada
 * participante, así que el total del grupo cambia `amount × participantes`.
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
  const participants = c.participantIds.length;
  const iParticipate = c.participantIds.includes(userId);
  return {
    ...c,
    total: c.total + amount * participants,
    myTotal: c.myTotal + (iParticipate ? amount : 0),
    myGroupTotal: c.myGroupTotal + (iParticipate ? amount : 0),
    displayTotal: c.displayTotal + amount,
    entryCount: c.entryCount + (amount > 0 ? participants : 0),
    myEntryCount: c.myEntryCount + (amount > 0 && iParticipate ? 1 : 0),
  };
}

function rollback(queryClient: QueryClient, context: OptimisticContext | undefined) {
  if (!context) return;
  queryClient.setQueryData(context.detailKey, context.previousDetail);
  queryClient.setQueryData(context.listKey, context.previousList);
}

/** +N. En un contador común se suma a todos sus participantes. */
export function useAddEntry() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: ({ counterId, input }: { counterId: string; input: EntryInput }) =>
      cachedCounter(queryClient, counterId)?.is_common
        ? addToCommonCounter(counterId, input)
        : createEntry(counterId, input),
    onMutate: ({ counterId, input }) =>
      applyOptimistic(queryClient, counterId, (c) => applyAmount(c, input.amount, userId)),
    onError: (_error, _variables, context) => rollback(queryClient, context),
    onSettled: () => invalidateCounters(queryClient),
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
    mutationFn: async (counterId: string) => {
      if (cachedCounter(queryClient, counterId)?.is_common) {
        await removeOneFromCommonCounter(counterId);
      } else {
        await removeOne(counterId);
      }
    },
    onMutate: (counterId) =>
      applyOptimistic(queryClient, counterId, (c) =>
        c.is_common
          ? applyAmount(c, -1, userId)
          : c.myGroupTotal < 1
            ? c
            : applyAmount(c, -1, userId),
      ),
    onError: (_error, _counterId, context) => rollback(queryClient, context),
    onSettled: () => invalidateCounters(queryClient),
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
