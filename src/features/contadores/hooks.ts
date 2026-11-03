import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  createCounter,
  createEntry,
  deleteCounter,
  deleteEntry,
  fetchCounter,
  fetchCounters,
  fetchEntries,
  updateCounter,
  updateEntry,
  type CounterInput,
  type CounterWithTotal,
  type EntryInput,
} from './api';

export const counterKeys = {
  all: ['counters'] as const,
  list: () => [...counterKeys.all, 'list'] as const,
  detail: (id: string) => [...counterKeys.all, 'detail', id] as const,
  entries: (id: string) => [...counterKeys.all, 'entries', id] as const,
};

// Tras cualquier cambio refrescamos todo lo de contadores: son pocas consultas y así la lista,
// el detalle y (en la Fase 2) las estadísticas nunca se desincronizan.
function invalidateCounters(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: counterKeys.all });
}

// --- Consultas --------------------------------------------------------------

export function useCounterList() {
  return useQuery({ queryKey: counterKeys.list(), queryFn: fetchCounters });
}

export function useCounter(id: string) {
  return useQuery({ queryKey: counterKeys.detail(id), queryFn: () => fetchCounter(id) });
}

export function useEntries(counterId: string) {
  return useQuery({
    queryKey: counterKeys.entries(counterId),
    queryFn: () => fetchEntries(counterId),
  });
}

// --- Contadores -------------------------------------------------------------

export function useCreateCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CounterInput) => createCounter(input),
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

function addToTotal(counter: CounterWithTotal, amount: number): CounterWithTotal {
  return { ...counter, total: counter.total + amount, entryCount: counter.entryCount + 1 };
}

/**
 * Añadir un registro actualiza el total en pantalla al instante (actualización optimista), tanto
 * en la lista como en el detalle, y si el servidor falla lo deshace. Así los botones +1/+5/+10
 * se sienten inmediatos.
 */
export function useAddEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ counterId, input }: { counterId: string; input: EntryInput }) =>
      createEntry(counterId, input),
    onMutate: async ({ counterId, input }) => {
      const detailKey = counterKeys.detail(counterId);
      const listKey = counterKeys.list();
      await queryClient.cancelQueries({ queryKey: counterKeys.all });

      const previousDetail = queryClient.getQueryData<CounterWithTotal>(detailKey);
      const previousList = queryClient.getQueryData<CounterWithTotal[]>(listKey);
      if (previousDetail) {
        queryClient.setQueryData(detailKey, addToTotal(previousDetail, input.amount));
      }
      if (previousList) {
        queryClient.setQueryData(
          listKey,
          previousList.map((c) => (c.id === counterId ? addToTotal(c, input.amount) : c)),
        );
      }
      return { detailKey, listKey, previousDetail, previousList };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.detailKey, context.previousDetail);
      queryClient.setQueryData(context.listKey, context.previousList);
    },
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
