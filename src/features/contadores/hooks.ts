import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';

import {
  createCounter,
  createEntry,
  deleteCounter,
  deleteEntry,
  fetchCounter,
  fetchCounters,
  fetchEntries,
  fetchLeaderboard,
  removeOne,
  updateCounter,
  updateEntry,
  type CounterInput,
  type CounterWithTotal,
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
};

// Tras cualquier cambio refrescamos todo lo de contadores: son pocas consultas y así la lista,
// el detalle, la clasificación y las estadísticas nunca se desincronizan.
function invalidateCounters(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: counterKeys.all });
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

export function useEntries(counterId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: counterKeys.entries(counterId),
    queryFn: () => fetchEntries(counterId, userId),
    enabled: userId !== '',
  });
}

export function useLeaderboard(counterId: string, period: LeaderboardPeriod, enabled: boolean) {
  return useQuery({
    queryKey: counterKeys.leaderboard(counterId, period),
    queryFn: () => fetchLeaderboard(counterId, period),
    enabled,
  });
}

// --- Contadores -------------------------------------------------------------

export function useCreateCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, groupId }: { input: CounterInput; groupId: string | null }) =>
      createCounter(input, groupId),
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

export function useDeleteCounter(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteCounter(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: counterKeys.detail(id) });
      return invalidateCounters(queryClient);
    },
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

function rollback(queryClient: QueryClient, context: OptimisticContext | undefined) {
  if (!context) return;
  queryClient.setQueryData(context.detailKey, context.previousDetail);
  queryClient.setQueryData(context.listKey, context.previousList);
}

export function useAddEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ counterId, input }: { counterId: string; input: EntryInput }) =>
      createEntry(counterId, input),
    onMutate: ({ counterId, input }) =>
      applyOptimistic(queryClient, counterId, (c) => ({
        ...c,
        total: c.total + input.amount,
        entryCount: c.entryCount + 1,
        myTotal: c.myTotal + input.amount,
        myEntryCount: c.myEntryCount + 1,
      })),
    onError: (_error, _variables, context) => rollback(queryClient, context),
    onSettled: () => invalidateCounters(queryClient),
  });
}

/** Botón −1: guarda un registro de −1 (mi total nunca baja de 0). No cuenta como registro. */
export function useRemoveOne() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (counterId: string) => removeOne(counterId),
    onMutate: (counterId) =>
      applyOptimistic(queryClient, counterId, (c) =>
        c.myTotal < 1 ? c : { ...c, total: c.total - 1, myTotal: c.myTotal - 1 },
      ),
    onError: (_error, _counterId, context) => rollback(queryClient, context),
    onSettled: () => invalidateCounters(queryClient),
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EntryInput }) => updateEntry(id, input),
    onSuccess: () => invalidateCounters(queryClient),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onSuccess: () => invalidateCounters(queryClient),
  });
}
