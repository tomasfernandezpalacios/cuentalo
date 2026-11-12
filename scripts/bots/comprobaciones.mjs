// Comprobaciones de coherencia: con la sesión de cada bot, se vuelve a calcular a mano lo que la
// app le enseña (totales, clasificaciones, rachas…) a partir de los registros que puede ver, y
// se compara. También se comprueba que nadie ve lo que no debe.

import { home } from './acciones.mjs';

const EPS = 1e-9;
const same = (a, b) => Math.abs(Number(a) - Number(b)) < EPS;

/** 'AAAA-MM-DD' del instante `iso` en la zona horaria `tz`. */
export function dayIn(iso, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Racha actual y mejor racha de unos días buenos (la de ayer sigue viva hasta que acabe hoy). */
export function streakOf(goodDays, today) {
  const set = new Set(goodDays);
  const runFrom = (day) => {
    let n = 0;
    for (let d = day; set.has(d); d = addDays(d, -1)) n++;
    return n;
  };
  const current = set.has(today) ? runFrom(today) : runFrom(addDays(today, -1));
  let best = 0;
  for (const d of set) if (!set.has(addDays(d, -1))) best = Math.max(best, runFrom2(set, d));
  return { current, best };
}

function runFrom2(set, start) {
  let n = 0;
  for (let d = start; set.has(d); d = addDays(d, 1)) n++;
  return n;
}

async function all(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await query().range(from, from + 999);
    if (res.error) throw new Error(res.error.message);
    rows.push(...res.data);
    if (res.data.length < 1000) return rows;
  }
}

export async function checkBot(bot, world) {
  const r = world.report;
  const h = await home(bot);
  const ids = h.counters.map((c) => c.id);
  const byId = new Map(h.counters.map((c) => [c.id, c]));

  // Registros que la RLS me deja ver de mis contadores.
  const entries = ids.length
    ? await all(() =>
        bot.db
          .from('entries')
          .select('id, counter_id, user_id, amount, logged_at, personal_only, group_only, common_batch')
          .in('counter_id', ids)
          .order('id'),
      )
    : [];

  // Mis grupos activos y sus miembros activos.
  const mine = await bot.db
    .from('group_members')
    .select('group_id')
    .eq('user_id', bot.id)
    .eq('status', 'active');
  const myGroups = new Set((mine.data ?? []).map((m) => m.group_id));
  const activeIn = new Map();
  for (const g of myGroups) {
    const m = await bot.db.from('group_members').select('user_id, status').eq('group_id', g);
    activeIn.set(
      g,
      new Set((m.data ?? []).filter((x) => x.status === 'active').map((x) => x.user_id)),
    );
  }

  // 1. Privacidad: de los demás solo veo registros no personales de contadores de un grupo
  //    donde los dos somos miembros activos.
  for (const e of entries) {
    if (e.user_id === bot.id) continue;
    const c = byId.get(e.counter_id);
    const ok =
      c?.group_id &&
      myGroups.has(c.group_id) &&
      activeIn.get(c.group_id)?.has(e.user_id) &&
      !e.personal_only;
    if (!ok) {
      r.add('CRÍTICO', bot, 'Ve un registro de otra persona que no debería ver', {
        contador: c?.name,
        registro: e.id,
        de: world.nameOf(e.user_id),
      });
    }
  }

  // 2. Totales de la pantalla principal = suma de los registros.
  const totals = new Map(h.totals.map((t) => [t.counter_id, t]));
  for (const c of h.counters) {
    const es = entries.filter((e) => e.counter_id === c.id);
    // En un común, cada suma (common_batch) cuenta una sola vez en el total del grupo.
    const seenBatches = new Set();
    const countsForGroup = (e) => {
      if (!e.common_batch) return true;
      if (seenBatches.has(e.common_batch)) return false;
      seenBatches.add(e.common_batch);
      return true;
    };
    const expected = {
      total: es
        .filter((e) => !e.personal_only)
        .filter(countsForGroup)
        .reduce((s, e) => s + Number(e.amount), 0),
      my_total: es
        .filter((e) => e.user_id === bot.id && !e.group_only)
        .reduce((s, e) => s + Number(e.amount), 0),
      my_group_total: es
        .filter((e) => e.user_id === bot.id && !e.personal_only)
        .reduce((s, e) => s + Number(e.amount), 0),
    };
    const t = totals.get(c.id) ?? { total: 0, my_total: 0, my_group_total: 0 };
    for (const k of Object.keys(expected)) {
      if (!same(t[k] ?? 0, expected[k])) {
        r.add('ERROR', bot, `El ${k} de un contador no cuadra con sus registros`, {
          contador: c.name,
          muestra: t[k],
          deberia: expected[k],
        });
      }
    }
    // 3. El −1 nunca deja lo mío por debajo de 0 (en los no comunes).
    if (!c.is_common && expected.my_group_total < -EPS) {
      r.add('ERROR', bot, 'Un contador ha quedado en negativo para su dueño', {
        contador: c.name,
        total: expected.my_group_total,
      });
    }
  }

  // 4. Clasificación (histórico) = suma por persona de los registros del grupo.
  for (const c of h.counters.filter((x) => x.group_id && myGroups.has(x.group_id))) {
    const lb = await bot.db.rpc('get_leaderboard', { counter_id: c.id, period: 'all' });
    if (lb.error) {
      r.add('ERROR', bot, 'La clasificación da error', {
        contador: c.name,
        error: lb.error.message,
      });
      continue;
    }
    for (const row of lb.data) {
      const expected = entries
        .filter((e) => e.counter_id === c.id && e.user_id === row.user_id && !e.personal_only)
        .reduce((s, e) => s + Number(e.amount), 0);
      if (!same(row.total, expected)) {
        r.add('ERROR', bot, 'La clasificación no cuadra con los registros del grupo', {
          contador: c.name,
          persona: world.nameOf(row.user_id),
          muestra: row.total,
          deberia: expected,
        });
      }
    }
    const members = activeIn.get(c.group_id) ?? new Set();
    if (lb.data.length !== members.size) {
      r.add('ERROR', bot, 'La clasificación no tiene a todos los miembros activos', {
        contador: c.name,
        filas: lb.data.length,
        miembros: members.size,
      });
    }
  }

  // 5. Rachas de los contadores en formato racha, recalculadas en mi zona horaria.
  const tz = bot.persona.timeZone;
  const today = dayIn(new Date().toISOString(), tz);
  const streaks = new Map(h.streaks.map((s) => [s.counter_id, s]));
  for (const c of h.counters.filter((x) => x.streak_enabled)) {
    const perDay = new Map();
    for (const e of entries) {
      if (e.counter_id !== c.id || e.user_id !== bot.id || e.group_only) continue;
      const d = dayIn(e.logged_at, tz);
      perDay.set(d, (perDay.get(d) ?? 0) + Number(e.amount));
    }
    const good = [...perDay].filter(([, v]) => v >= 1).map(([d]) => d);
    const expected = streakOf(good, today);
    const s = streaks.get(c.id) ?? { current_days: 0, best_days: 0 };
    if (s.current_days !== expected.current || (s.best_days ?? 0) !== expected.best) {
      r.add('ERROR', bot, 'La racha de un contador no cuadra con sus registros', {
        contador: c.name,
        zona: tz,
        muestra: `${s.current_days} (récord ${s.best_days ?? 0})`,
        deberia: `${expected.current} (récord ${expected.best})`,
      });
    }
  }

  // 6. Racha de uso: si hoy he apuntado algo, hoy cuenta.
  if (bot.state.loggedToday) {
    const act = await bot.db.from('user_activity_days').select('day').eq('day', today);
    if (!act.error && act.data.length === 0) {
      r.add('ERROR', bot, 'Ha registrado hoy pero la racha de uso no cuenta hoy', {
        zona: tz,
        hoy: today,
      });
    }
  }

  // 7. Rachas de amigos: solo yo y mis amigos aceptados.
  const fr = await bot.db.rpc('get_friends_streaks');
  const friends = await bot.db
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted');
  if (!fr.error && !friends.error) {
    const allowed = new Set([
      bot.id,
      ...friends.data.map((f) => (f.requester_id === bot.id ? f.addressee_id : f.requester_id)),
    ]);
    for (const row of fr.data) {
      if (!allowed.has(row.user_id)) {
        r.add('CRÍTICO', bot, 'Ve la racha de alguien que no es su amigo', {
          persona: world.nameOf(row.user_id),
        });
      }
    }
  }

  // 8. El código de cada grupo es el mismo para todos sus miembros.
  for (const g of myGroups) {
    const code = await bot.db.rpc('get_group_invite_code', { p_group_id: g });
    if (code.error) {
      r.add('ERROR', bot, 'Un miembro no puede ver el código de su grupo', {
        error: code.error.message,
      });
      continue;
    }
    const known = world.codes.get(g);
    if (known && known !== code.data) {
      r.add('ERROR', bot, 'El código de un grupo cambia según quién lo mire', {});
    }
    world.codes.set(g, code.data);
  }

  // 9. Contadores comunes: todos los participantes activos llevan lo mismo.
  for (const c of h.counters.filter((x) => x.is_common && myGroups.has(x.group_id))) {
    const parts = h.participants.filter((p) => p.counter_id === c.id).map((p) => p.user_id);
    const active = parts.filter((u) => activeIn.get(c.group_id)?.has(u));
    const sums = active.map((u) =>
      entries
        .filter((e) => e.counter_id === c.id && e.user_id === u)
        .reduce((s, e) => s + Number(e.amount), 0),
    );
    if (sums.length > 1 && sums.some((v) => !same(v, sums[0]))) {
      r.add('AVISO', bot, 'En un contador común los participantes llevan cantidades distintas', {
        contador: c.name,
        cantidades: sums.join(' / '),
        nota: 'Puede ser correcto si alguien se añadió como participante después.',
      });
    }
  }

  // 10. Observaciones de uso (no son fallos, pero chirrían).
  const names = h.counters
    .filter((c) => c.group_id === null && c.owner_id === bot.id)
    .map((c) => c.name.toLowerCase());
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) {
    r.add('OBSERVACIÓN', bot, 'Se pueden tener dos contadores propios con el mismo nombre', {
      nombres: [...new Set(dup)].join(', '),
    });
  }

  return {
    contadores: h.counters.length,
    registrosVisibles: entries.length,
    grupos: myGroups.size,
  };
}
