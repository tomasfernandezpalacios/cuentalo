import type { Tables, Views } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Counter = Tables<'counters'>;
export type Entry = Tables<'entries'>;
export type CounterTotal = Views<'counter_totals'>;
export type LeaderboardPeriod = 'week' | 'month' | 'year' | 'all';

export type CounterGroup = { id: string; name: string; ownerId: string };

export type CounterWithTotal = Counter & {
  /** Lo que veo: en un compartido, la suma de todo el grupo. */
  total: number;
  entryCount: number;
  /** Solo lo mío. En un privado coincide con total. */
  myTotal: number;
  myEntryCount: number;
  /** Grupo con el que se comparte (null si es privado o ya no soy miembro). */
  group: CounterGroup | null;
  /**
   * Sale en "Mis contadores": privado mío o de un grupo donde soy miembro activo. Los contadores
   * de grupos de los que salí solo se usan para mis estadísticas.
   */
  isActive: boolean;
  /** Puedo editarlo y archivarlo (dueño, o owner del grupo en un compartido). */
  canManage: boolean;
  /** Contador común: cada +1/−1 se aplica a todos estos participantes. Vacío si no es común. */
  participantIds: string[];
  /**
   * Número que se enseña en la tarjeta y en grande en el detalle: lo mío. En un común del que no
   * soy participante, lo que lleva cada participante (la media, porque suman a la vez).
   */
  displayTotal: number;
  /** Último registro que veo (de cualquiera, en un compartido), o null si no hay. */
  lastLoggedAt: string | null;
};

/** La unidad y el emoticono son opcionales: una cadena vacía se guarda como null. */
export type CounterInput = { name: string; unit: string; emoji: string };
export type EntryInput = { amount: number; loggedAt: Date; note: string | null };

export type LeaderboardRow = {
  userId: string;
  username: string;
  displayName: string;
  total: number;
  entryCount: number;
  position: number;
};

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

/** Grupos en los que soy miembro activo, por id. */
async function fetchMyActiveGroups(myId: string): Promise<Map<string, CounterGroup>> {
  const memberships = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', myId)
    .eq('status', 'active');
  if (memberships.error) throw memberships.error;
  const ids = memberships.data.map((m) => m.group_id);
  if (ids.length === 0) return new Map();

  const groups = await supabase.from('groups').select('id, name, owner_id').in('id', ids);
  if (groups.error) throw groups.error;
  return new Map(groups.data.map((g) => [g.id, { id: g.id, name: g.name, ownerId: g.owner_id }]));
}

/** Añade totales, grupo y permisos a un contador (exportada para los tests). */
export function enrich(
  counter: Counter,
  totals: CounterTotal[],
  groups: Map<string, CounterGroup>,
  myId: string,
  participants: Map<string, string[]> = new Map(),
): CounterWithTotal {
  const t = totals.find((row) => row.counter_id === counter.id);
  const group = counter.group_id ? (groups.get(counter.group_id) ?? null) : null;
  const isActive = counter.group_id ? group !== null : counter.owner_id === myId;
  const participantIds = counter.is_common ? (participants.get(counter.id) ?? []) : [];
  const canManage = counter.group_id
    ? group !== null && (counter.owner_id === myId || group.ownerId === myId)
    : counter.owner_id === myId;
  return {
    ...counter,
    total: t?.total ?? 0,
    entryCount: t?.entry_count ?? 0,
    myTotal: t?.my_total ?? 0,
    myEntryCount: t?.my_entry_count ?? 0,
    group,
    isActive,
    canManage,
    participantIds,
    lastLoggedAt: t?.last_logged_at ?? null,
    displayTotal:
      counter.is_common && !participantIds.includes(myId) && participantIds.length > 0
        ? (t?.total ?? 0) / participantIds.length
        : (t?.my_total ?? 0),
  };
}

/** Participantes de los contadores comunes que veo, agrupados por contador. */
async function fetchParticipants(counterIds?: string[]): Promise<Map<string, string[]>> {
  let query = supabase.from('counter_participants').select('counter_id, user_id');
  if (counterIds) query = query.in('counter_id', counterIds);
  const { data, error } = await query;
  if (error) throw error;
  const result = new Map<string, string[]>();
  for (const row of data) {
    result.set(row.counter_id, [...(result.get(row.counter_id) ?? []), row.user_id]);
  }
  return result;
}

// --- Contadores -------------------------------------------------------------

export async function fetchCounters(myId: string): Promise<CounterWithTotal[]> {
  const [counters, totals, groups, participants] = await Promise.all([
    supabase.from('counters').select('*').order('created_at', { ascending: true }),
    supabase.from('counter_totals').select('*'),
    fetchMyActiveGroups(myId),
    fetchParticipants(),
  ]);
  if (counters.error) throw counters.error;
  if (totals.error) throw totals.error;
  return counters.data.map((counter) => enrich(counter, totals.data, groups, myId, participants));
}

export async function fetchCounter(id: string, myId: string): Promise<CounterWithTotal> {
  const [counter, totals, groups, participants] = await Promise.all([
    supabase.from('counters').select('*').eq('id', id).single(),
    supabase.from('counter_totals').select('*').eq('counter_id', id),
    fetchMyActiveGroups(myId),
    fetchParticipants([id]),
  ]);
  if (counter.error) throw counter.error;
  if (totals.error) throw totals.error;
  return enrich(counter.data, totals.data, groups, myId, participants);
}

/**
 * Crea un contador privado (groupId null) o compartido con un grupo. Si se pasan participantes,
 * es un contador común.
 */
export async function createCounter(
  { name, unit, emoji }: CounterInput,
  groupId: string | null,
  participantIds: string[] | null = null,
): Promise<Counter> {
  const isCommon = groupId !== null && participantIds !== null;
  const { data, error } = await supabase
    .from('counters')
    .insert({
      name: name.trim(),
      unit: emptyToNull(unit),
      emoji: emptyToNull(emoji),
      group_id: groupId,
      is_common: isCommon,
    })
    .select()
    .single();
  if (error) throw error;
  if (isCommon) await setParticipants(data.id, participantIds);
  return data;
}

export async function setParticipants(counterId: string, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_counter_participants', {
    p_counter_id: counterId,
    p_user_ids: userIds,
  });
  if (error) throw error;
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

/** Mi historial en el contador (en un compartido, solo mis registros). */
export async function fetchEntries(counterId: string, myId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('counter_id', counterId)
    .eq('user_id', myId)
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

/** Guarda un registro de −1 si mi total en el contador es al menos 1. */
export async function removeOne(counterId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('remove_one_from_counter', {
    p_counter_id: counterId,
  });
  if (error) throw error;
  return data;
}

/** Contador común: suma la cantidad a todos los participantes que siguen en el grupo. */
export async function addToCommonCounter(counterId: string, input: EntryInput): Promise<void> {
  const { error } = await supabase.rpc('add_to_common_counter', {
    p_counter_id: counterId,
    p_amount: input.amount,
    p_logged_at: input.loggedAt.toISOString(),
    p_note: input.note,
  });
  if (error) throw error;
}

/** Contador común: resta 1 a todos los participantes que tengan al menos 1. */
export async function removeOneFromCommonCounter(counterId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_one_from_common_counter', {
    p_counter_id: counterId,
  });
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

// --- Clasificación ----------------------------------------------------------

export async function fetchLeaderboard(
  counterId: string,
  period: LeaderboardPeriod,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    counter_id: counterId,
    period,
  });
  if (error) throw error;
  return data.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    total: row.total,
    entryCount: row.entry_count,
    position: row.position,
  }));
}

/** De estos contadores, el último en el que he registrado algo (o null si ninguno). */
export async function fetchMyLastCounterId(
  counterIds: string[],
  myId: string,
): Promise<string | null> {
  if (counterIds.length === 0) return null;
  const { data, error } = await supabase
    .from('entries')
    .select('counter_id')
    .eq('user_id', myId)
    .in('counter_id', counterIds)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0]?.counter_id ?? null;
}
