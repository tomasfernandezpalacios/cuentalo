import type { Tables, Views } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Counter = Tables<'counters'>;
export type Entry = Tables<'entries'>;
export type CounterTotal = Views<'counter_totals'>;

export type CounterWithTotal = Counter & { total: number; entryCount: number };

/** La unidad y el emoticono son opcionales: una cadena vacía se guarda como null. */
export type CounterInput = { name: string; unit: string; emoji: string };
export type EntryInput = { amount: number; loggedAt: Date; note: string | null };

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

function withTotal(counter: Counter, totals: CounterTotal[]): CounterWithTotal {
  const total = totals.find((t) => t.counter_id === counter.id);
  return { ...counter, total: total?.total ?? 0, entryCount: total?.entry_count ?? 0 };
}

// --- Contadores -------------------------------------------------------------

export async function fetchCounters(): Promise<CounterWithTotal[]> {
  const [counters, totals] = await Promise.all([
    supabase.from('counters').select('*').order('created_at', { ascending: true }),
    supabase.from('counter_totals').select('*'),
  ]);
  if (counters.error) throw counters.error;
  if (totals.error) throw totals.error;
  return counters.data.map((counter) => withTotal(counter, totals.data));
}

export async function fetchCounter(id: string): Promise<CounterWithTotal> {
  const [counter, totals] = await Promise.all([
    supabase.from('counters').select('*').eq('id', id).single(),
    supabase.from('counter_totals').select('*').eq('counter_id', id),
  ]);
  if (counter.error) throw counter.error;
  if (totals.error) throw totals.error;
  return withTotal(counter.data, totals.data);
}

export async function createCounter({ name, unit, emoji }: CounterInput): Promise<Counter> {
  const { data, error } = await supabase
    .from('counters')
    .insert({ name: name.trim(), unit: emptyToNull(unit), emoji: emptyToNull(emoji) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCounter(
  id: string,
  patch: Partial<CounterInput> & { archived?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('counters')
    .update({
      name: patch.name?.trim(),
      unit: patch.unit === undefined ? undefined : emptyToNull(patch.unit),
      emoji: patch.emoji === undefined ? undefined : emptyToNull(patch.emoji),
      archived: patch.archived,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCounter(id: string): Promise<void> {
  const { error } = await supabase.from('counters').delete().eq('id', id);
  if (error) throw error;
}

// --- Registros --------------------------------------------------------------

const ENTRIES_PAGE_SIZE = 100;

export async function fetchEntries(counterId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('counter_id', counterId)
    .order('logged_at', { ascending: false })
    .limit(ENTRIES_PAGE_SIZE);
  if (error) throw error;
  return data;
}

export async function createEntry(counterId: string, input: EntryInput): Promise<void> {
  const { error } = await supabase.from('entries').insert({
    counter_id: counterId,
    amount: input.amount,
    logged_at: input.loggedAt.toISOString(),
    note: input.note,
  });
  if (error) throw error;
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ amount: input.amount, logged_at: input.loggedAt.toISOString(), note: input.note })
    .eq('id', id);
  if (error) throw error;
}

/** Resta 1 a mi último registro del contador (lo borra si era de 1 o menos). */
export async function removeOne(counterId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('remove_one_from_counter', {
    p_counter_id: counterId,
  });
  if (error) throw error;
  return data;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}
