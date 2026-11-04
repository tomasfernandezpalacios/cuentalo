// Contadores de grupo enlazados por una fusión: para el usuario son un único contador.
// Función pura (sin red) para poder testearla.

import type { CounterGroup, CounterWithTotal } from './api';

export type CounterLink = { counterId: string; linkId: string; isPrimary: boolean };

/** Un grupo del contador visible, con el total de ese grupo. */
export type LinkedGroup = { counterId: string; group: CounterGroup; total: number };

/**
 * Junta en un solo contador los enlazados: el principal (o, si ya no está activo, el primero
 * activo) se queda con la suma de lo mío de todos y la lista de grupos; los demás quedan marcados
 * con `linkedInto` para no salir en la lista y para que las estadísticas los sumen al principal.
 */
export function applyLinks(counters: CounterWithTotal[], links: CounterLink[]): CounterWithTotal[] {
  const byId = new Map(counters.map((c) => [c.id, c]));
  const result = new Map(counters.map((c) => [c.id, c]));

  const linkIds = [...new Set(links.map((l) => l.linkId))];
  for (const linkId of linkIds) {
    const members = links
      .filter((l) => l.linkId === linkId)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((l) => byId.get(l.counterId))
      .filter((c): c is CounterWithTotal => c !== undefined);
    if (members.length < 2) continue;

    const display = members.find((c) => c.isActive) ?? members[0];
    if (!display) continue;

    const linkedGroups = members.flatMap((c) =>
      c.group && c.isActive ? [{ counterId: c.id, group: c.group, total: c.total }] : [],
    );
    const last = members
      .map((c) => c.lastLoggedAt)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);

    result.set(display.id, {
      ...display,
      linkedCounterIds: members.map((c) => c.id),
      linkedGroups,
      myTotal: members.reduce((sum, c) => sum + c.myTotal, 0),
      myEntryCount: members.reduce((sum, c) => sum + c.myEntryCount, 0),
      displayTotal: members.reduce((sum, c) => sum + c.myTotal, 0),
      // El −1 se puede pulsar si en algún grupo llevo al menos 1.
      myGroupTotal: Math.max(...members.map((c) => c.myGroupTotal)),
      lastLoggedAt: last ?? null,
    });
    for (const member of members) {
      if (member.id !== display.id) {
        result.set(member.id, { ...member, linkedInto: display.id });
      }
    }
  }
  return counters.map((c) => result.get(c.id) ?? c);
}

/** Para las estadísticas: id del contador que se ve (el principal si está enlazado). */
export function visibleCounterId(counters: CounterWithTotal[]): (id: string) => string {
  const map = new Map(counters.map((c) => [c.id, c.linkedInto ?? c.id]));
  return (id) => map.get(id) ?? id;
}
