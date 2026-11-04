import type { Tables, Views } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { applyLinks, type CounterLink, type LinkedGroup } from './links';

export type Counter = Tables<'counters'>;
export type Entry = Tables<'entries'>;
export type CounterTotal = Views<'counter_totals'>;
export type LeaderboardPeriod = 'week' | 'month' | 'year' | 'all';

export type CounterGroup = {
  id: string;
  name: string;
  ownerId: string;
  emoji: string | null;
  photoPath: string | null;
};

export type CounterWithTotal = Counter & {
  /** Lo que veo: en un compartido, la suma de todo el grupo. */
  total: number;
  entryCount: number;
  /** Solo lo mío (incluye registros solo personales de una fusión). */
  myTotal: number;
  myEntryCount: number;
  /** Lo mío que cuenta para el contador (sin solo personales). Decide si se puede pulsar −1. */
  myGroupTotal: number;
  /**
   * Nombre e icono reales, compartidos con el grupo. `name`/`emoji` pueden ser un alias que
   * solo veo yo (al fusionar un contador de grupo); al editar se usan estos.
   */
  sharedName: string;
  sharedEmoji: string | null;
  /** Grupo con el que se comparte (null si es privado o ya no soy miembro). */
  group: CounterGroup | null;
  /**
   * Sale en "Mis contadores": privado mío o de un grupo donde soy miembro activo. Los contadores
   * de grupos de los que salí solo se usan para mis estadísticas.
   */
  isActive: boolean;
  /**
   * Soy su administrador: lo creé (en un privado, es mío). Solo él lo edita y lo borra; en un
   * común, además, es el único que suma o resta (los demás le envían solicitudes).
   */
  canManage: boolean;
  /** Lo he ocultado de mi lista (sale al final, en «Ocultos»). */
  hidden: boolean;
  /** Contador común: cada +1/−1 se aplica a todos estos participantes. Vacío si no es común. */
  participantIds: string[];
  /**
   * Número que se enseña en la tarjeta y en grande en el detalle: lo mío. En un común del que no
   * soy participante, lo que lleva cada participante (la media, porque suman a la vez).
   */
  displayTotal: number;
  /** Último registro que veo (de cualquiera, en un compartido), o null si no hay. */
  lastLoggedAt: string | null;
  /**
   * Contadores que para mí son este mismo (enlazados al fusionar varios de grupo), incluido él.
   * Si no está enlazado, solo su propio id.
   */
  linkedCounterIds: string[];
  /** Grupos en los que cuenta, con el total de cada uno. */
  linkedGroups: LinkedGroup[];
  /** Si es un enlazado secundario: id del contador que lo representa (no sale en la lista). */
  linkedInto: string | null;
};

/** La unidad y el emoticono son opcionales: una cadena vacía se guarda como null. */
export type CounterInput = {
  name: string;
  unit: string;
  emoji: string;
  /** Solo en individuales: si es true, mis amigos no lo ven en mi perfil. */
  hiddenFromFriends: boolean;
};
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

  const groups = await supabase
    .from('groups')
    .select('id, name, owner_id, emoji, photo_path')
    .in('id', ids);
  if (groups.error) throw groups.error;
  return new Map(
    groups.data.map((g) => [
      g.id,
      { id: g.id, name: g.name, ownerId: g.owner_id, emoji: g.emoji, photoPath: g.photo_path },
    ]),
  );
}

/** Añade totales, grupo y permisos a un contador (exportada para los tests). */
export function enrich(
  counter: Counter,
  totals: CounterTotal[],
  groups: Map<string, CounterGroup>,
  myId: string,
  participants: Map<string, string[]> = new Map(),
  aliases: Map<string, { name: string | null; emoji: string | null }> = new Map(),
  hidden: Set<string> = new Set(),
): CounterWithTotal {
  const t = totals.find((row) => row.counter_id === counter.id);
  const group = counter.group_id ? (groups.get(counter.group_id) ?? null) : null;
  const isActive = counter.group_id ? group !== null : counter.owner_id === myId;
  const participantIds = counter.is_common ? (participants.get(counter.id) ?? []) : [];
  const canManage = counter.owner_id === myId && (counter.group_id === null || group !== null);
  const alias = aliases.get(counter.id);
  return {
    ...counter,
    name: alias?.name ?? counter.name,
    emoji: alias?.emoji ?? counter.emoji,
    sharedName: counter.name,
    sharedEmoji: counter.emoji,
    myGroupTotal: t?.my_group_total ?? 0,
    total: t?.total ?? 0,
    entryCount: t?.entry_count ?? 0,
    myTotal: t?.my_total ?? 0,
    myEntryCount: t?.my_entry_count ?? 0,
    group,
    isActive,
    canManage,
    participantIds,
    lastLoggedAt: t?.last_logged_at ?? null,
    hidden: hidden.has(counter.id),
    linkedCounterIds: [counter.id],
    linkedGroups: group && isActive ? [{ counterId: counter.id, group, total: t?.total ?? 0 }] : [],
    linkedInto: null,
    displayTotal:
      counter.is_common && !participantIds.includes(myId) && participantIds.length > 0
        ? (t?.total ?? 0) / participantIds.length
        : (t?.my_total ?? 0),
  };
}

async function fetchHidden(): Promise<Set<string>> {
  const { data, error } = await supabase.from('hidden_counters').select('counter_id');
  if (error) throw error;
  return new Set(data.map((h) => h.counter_id));
}

async function fetchLinks(): Promise<CounterLink[]> {
  const { data, error } = await supabase
    .from('counter_links')
    .select('counter_id, link_id, is_primary');
  if (error) throw error;
  return data.map((l) => ({ counterId: l.counter_id, linkId: l.link_id, isPrimary: l.is_primary }));
}

/** Mis alias (nombre e icono personales) por contador. */
async function fetchAliases(): Promise<Map<string, { name: string | null; emoji: string | null }>> {
  const { data, error } = await supabase.from('counter_aliases').select('counter_id, name, emoji');
  if (error) throw error;
  return new Map(data.map((a) => [a.counter_id, { name: a.name, emoji: a.emoji }]));
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
  const [counters, totals, groups, participants, aliases, links, hidden] = await Promise.all([
    supabase.from('counters').select('*').order('created_at', { ascending: true }),
    supabase.from('counter_totals').select('*'),
    fetchMyActiveGroups(myId),
    fetchParticipants(),
    fetchAliases(),
    fetchLinks(),
    fetchHidden(),
  ]);
  if (counters.error) throw counters.error;
  if (totals.error) throw totals.error;
  const enriched = counters.data.map((counter) =>
    enrich(counter, totals.data, groups, myId, participants, aliases, hidden),
  );
  return applyLinks(enriched, links);
}

/** Un contador ya combinado con sus enlazados (se apoya en la lista completa). */
export async function fetchCounter(id: string, myId: string): Promise<CounterWithTotal> {
  const all = await fetchCounters(myId);
  const counter = all.find((c) => c.id === id);
  if (counter)
    return counter.linkedInto ? (all.find((c) => c.id === counter.linkedInto) ?? counter) : counter;
  return fetchSingleCounter(id, myId);
}

async function fetchSingleCounter(id: string, myId: string): Promise<CounterWithTotal> {
  const [counter, totals, groups, participants, aliases] = await Promise.all([
    supabase.from('counters').select('*').eq('id', id).single(),
    supabase.from('counter_totals').select('*').eq('counter_id', id),
    fetchMyActiveGroups(myId),
    fetchParticipants([id]),
    fetchAliases(),
  ]);
  if (counter.error) throw counter.error;
  if (totals.error) throw totals.error;
  return enrich(counter.data, totals.data, groups, myId, participants, aliases);
}

/**
 * Crea un contador privado (groupId null) o compartido con un grupo. Si se pasan participantes,
 * es un contador común.
 */
export async function createCounter(
  { name, unit, emoji, hiddenFromFriends }: CounterInput,
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
      hidden_from_friends: groupId === null && hiddenFromFriends,
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
      hidden_from_friends: patch.hiddenFromFriends,
    })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Fusiona contadores. Devuelve el id del contador que queda. Ver la migración
 * fusionar_contadores para las reglas (como mucho uno de grupo, nunca comunes).
 */
export async function mergeCounters(
  counterIds: string[],
  name: string,
  emoji: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('merge_counters', {
    p_counter_ids: counterIds,
    p_name: name.trim() || null,
    p_emoji: emoji.trim() || null,
  });
  if (error) throw error;
  return data;
}

/**
 * Borra un contador. Si es privado, desaparece con sus registros. Si es de un grupo (solo su
 * administrador puede), solo sale del grupo: cada miembro conserva sus registros.
 */
export async function deleteCounter(counter: Pick<Counter, 'id' | 'group_id'>): Promise<void> {
  const { error } = counter.group_id
    ? await supabase.rpc('delete_group_counter', { p_counter_id: counter.id })
    : await supabase.from('counters').delete().eq('id', counter.id);
  if (error) throw error;
}

/** Oculta o vuelve a mostrar contadores en mi lista. */
export async function setHidden(counterIds: string[], hidden: boolean): Promise<void> {
  const { error } = hidden
    ? await supabase.from('hidden_counters').upsert(
        counterIds.map((counter_id) => ({ counter_id })),
        { ignoreDuplicates: true },
      )
    : await supabase.from('hidden_counters').delete().in('counter_id', counterIds);
  if (error) throw error;
}

/** Contador común de otro: pide a su administrador que sume (o reste) a todos. */
export async function requestCommonChange(counterId: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from('counter_requests')
    .insert({ counter_id: counterId, amount });
  if (error) throw error;
}

// --- Registros --------------------------------------------------------------

const ENTRIES_PAGE_SIZE = 100;

/**
 * Mi historial en el contador y sus enlazados, sin repetir las copias de un mismo registro (en
 * un compartido, solo mis registros).
 */
export async function fetchEntries(counterIds: string[], myId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .in('counter_id', counterIds)
    .eq('user_id', myId)
    .eq('group_only', false)
    .order('logged_at', { ascending: false })
    .limit(ENTRIES_PAGE_SIZE);
  if (error) throw error;
  return data;
}

/** +N. Si el contador está enlazado con otros, se apunta en todos (ver log_to_counter). */
export async function createEntry(counterId: string, input: EntryInput): Promise<void> {
  const { error } = await supabase.rpc('log_to_counter', {
    p_counter_id: counterId,
    p_amount: input.amount,
    p_logged_at: input.loggedAt.toISOString(),
    p_note: input.note,
  });
  if (error) throw error;
}

/** Edita un registro y, si tiene copias en contadores enlazados, también las copias. */
export async function updateEntry(entry: Entry, input: EntryInput): Promise<void> {
  const query = supabase
    .from('entries')
    .update({ amount: input.amount, logged_at: input.loggedAt.toISOString(), note: input.note });
  const { error } = await (entry.batch_id
    ? query.eq('batch_id', entry.batch_id)
    : query.eq('id', entry.id));
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

/** Borra un registro y sus copias en contadores enlazados. */
export async function deleteEntry(entry: Entry): Promise<void> {
  const query = supabase.from('entries').delete();
  const { error } = await (entry.batch_id
    ? query.eq('batch_id', entry.batch_id)
    : query.eq('id', entry.id));
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
