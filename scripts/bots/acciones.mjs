// Lo que puede hacer un bot. Cada acción hace exactamente las mismas llamadas a Supabase que la
// app (mismas tablas y funciones) y devuelve una frase con lo que ha hecho, o null si en ese
// momento no tenía sentido (p. ej. restar sin contadores): entonces el bot elige otra cosa.
//
// Los errores «de negocio» que la app también evitaría (p. ej. una solicitud de amistad
// repetida) se comprueban antes, como haría una persona mirando la pantalla. Cualquier otro
// error se registra como fallo.

const pick = (rng, list) => (list.length ? list[Math.floor(rng() * list.length)] : undefined);
const chance = (rng, p) => rng() < p;

function check({ error }, what) {
  if (error) {
    const e = new Error(`${what}: ${error.message}`);
    e.supabase = error;
    throw e;
  }
}

/** Contadores que el bot ve en su pantalla principal (como la app: get_my_home). */
export async function home(bot) {
  const res = await bot.db.rpc('get_my_home');
  check(res, 'get_my_home');
  return res.data;
}

async function myActiveGroups(bot) {
  const res = await bot.db
    .from('group_members')
    .select('group_id, role, status')
    .eq('user_id', bot.id)
    .eq('status', 'active');
  check(res, 'leer mis grupos');
  return res.data.map((m) => m.group_id);
}

async function groupMembers(bot, groupId) {
  const res = await bot.db.from('group_members').select('user_id, status').eq('group_id', groupId);
  check(res, 'leer miembros');
  return res.data;
}

function myCounters(h, bot) {
  return h.counters.filter((c) => c.group_id === null && c.owner_id === bot.id);
}

function groupCountersOf(h, groups) {
  return h.counters.filter((c) => c.group_id && groups.includes(c.group_id));
}

function daysAgoIso(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

async function log(bot, counterId, amount, loggedAt = new Date().toISOString()) {
  check(
    await bot.db.rpc('log_to_counter', {
      p_counter_id: counterId,
      p_amount: amount,
      p_logged_at: loggedAt,
      p_note: null,
    }),
    'log_to_counter',
  );
  bot.state.loggedToday = true;
}

export const ACTIONS = {
  async crearContador(bot, world) {
    const h = await home(bot);
    const names = new Set(myCounters(h, bot).map((c) => c.name));
    const idea = bot.persona.counters.find((c) => !names.has(c.name));
    // Una persona caótica a veces repite nombre o crea uno con nombre raro.
    const def = idea ?? {
      name: chance(bot.rng, 0.5) ? (pick(bot.rng, [...names]) ?? 'Otro') : `Cosa ${world.round}`,
      emoji: null,
      unit: null,
      streak: chance(bot.rng, 0.3),
    };
    const res = await bot.db
      .from('counters')
      .insert({
        name: def.name,
        unit: def.unit,
        emoji: def.emoji,
        streak_enabled: def.streak,
        hidden_from_friends: chance(bot.rng, 0.2),
      })
      .select('id')
      .single();
    check(res, 'crear contador');
    return `crea el contador «${def.name}»${def.streak ? ' (formato racha)' : ''}`;
  },

  async sumar(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, myCounters(h, bot));
    if (!c) return null;
    const amount = pick(bot.rng, bot.persona.amounts);
    await log(bot, c.id, amount);
    return `+${amount} en «${c.name}»`;
  },

  async sumarAtrasado(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, myCounters(h, bot));
    if (!c) return null;
    const days = 1 + Math.floor(bot.rng() * 12);
    const amount = pick(bot.rng, bot.persona.amounts);
    await log(bot, c.id, amount, daysAgoIso(days));
    return `+${amount} en «${c.name}» con fecha de hace ${days} días`;
  },

  async restar(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, myCounters(h, bot));
    if (!c) return null;
    const res = await bot.db.rpc('remove_one_from_counter', { p_counter_id: c.id });
    check(res, 'remove_one_from_counter');
    return `−1 en «${c.name}» (${res.data ? 'restado' : 'no se podía: ya estaba en 0'})`;
  },

  async deshacer(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, myCounters(h, bot));
    if (!c) return null;
    const res = await bot.db.rpc('undo_last_entry', { p_counter_id: c.id });
    check(res, 'undo_last_entry');
    return `deshacer en «${c.name}» (${res.data ? 'deshecho' : 'nada reciente'})`;
  },

  async editarContador(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, myCounters(h, bot));
    if (!c) return null;
    const name = `${c.name.replace(/ \(\d+\)$/, '')} (${Math.floor(bot.rng() * 90) + 10})`.slice(
      0,
      60,
    );
    check(await bot.db.from('counters').update({ name }).eq('id', c.id), 'editar contador');
    return `renombra «${c.name}» a «${name}»`;
  },

  async ocultar(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, h.counters);
    if (!c) return null;
    if (h.hidden.includes(c.id)) {
      check(await bot.db.from('hidden_counters').delete().eq('counter_id', c.id), 'mostrar');
      return `vuelve a mostrar «${c.name}»`;
    }
    check(
      await bot.db.from('hidden_counters').upsert({ counter_id: c.id }, { ignoreDuplicates: true }),
      'ocultar',
    );
    return `oculta «${c.name}»`;
  },

  async carpeta(bot) {
    const h = await home(bot);
    const ids = h.counters.filter(() => chance(bot.rng, 0.5)).map((c) => c.id);
    if (ids.length === 0) return null;
    const name = pick(bot.rng, ['Salud', 'Vicios', 'Deporte', 'Ocio']);
    check(
      await bot.db.rpc('save_folder', { p_folder_id: null, p_name: name, p_counter_ids: ids }),
      'save_folder',
    );
    return `crea la carpeta «${name}» con ${ids.length} contadores`;
  },

  async fusionar(bot) {
    const h = await home(bot);
    const mine = myCounters(h, bot).filter((c) => !c.streak_enabled);
    if (mine.length < 2) return null;
    const [a, b] = [...mine].sort(() => bot.rng() - 0.5);
    const res = await bot.db.rpc('merge_counters', {
      p_counter_ids: [a.id, b.id],
      p_name: a.name,
      p_emoji: a.emoji,
    });
    check(res, 'merge_counters');
    return `fusiona «${b.name}» en «${a.name}»`;
  },

  async borrarContador(bot) {
    const h = await home(bot);
    const c = pick(bot.rng, myCounters(h, bot));
    if (!c || myCounters(h, bot).length < 3) return null;
    check(await bot.db.from('counters').delete().eq('id', c.id), 'borrar contador');
    return `borra «${c.name}»`;
  },

  async mirarEstadisticas(bot) {
    const res = await bot.db
      .from('entry_daily_totals')
      .select('counter_id, day, total')
      .eq('user_id', bot.id)
      .order('day');
    check(res, 'entry_daily_totals');
    return `mira sus estadísticas (${res.data.length} días con registros)`;
  },

  async enviarAmistad(bot, world) {
    const other = pick(
      bot.rng,
      world.bots.filter((b) => b !== bot),
    );
    const res = await bot.db
      .from('friendships')
      .select('id, status, requester_id')
      .or(`requester_id.eq.${other.id},addressee_id.eq.${other.id}`);
    check(res, 'leer amistades');
    if (res.data.length > 0) return null; // ya hay solicitud o amistad: en la app no saldría el botón
    check(await bot.db.from('friendships').insert({ addressee_id: other.id }), 'enviar amistad');
    return `envía solicitud de amistad a ${other.persona.username}`;
  },

  async responderAmistad(bot) {
    const res = await bot.db
      .from('friendships')
      .select('id, requester_id')
      .eq('addressee_id', bot.id)
      .eq('status', 'pending');
    check(res, 'leer solicitudes');
    const req = pick(bot.rng, res.data);
    if (!req) return null;
    const status = chance(bot.rng, 0.85) ? 'accepted' : 'rejected';
    check(
      await bot.db.from('friendships').update({ status }).eq('id', req.id),
      'responder amistad',
    );
    return `${status === 'accepted' ? 'acepta' : 'rechaza'} una solicitud de amistad`;
  },

  async crearGrupo(bot, world) {
    const groups = await myActiveGroups(bot);
    if (groups.length >= 2) return null;
    const name = pick(bot.rng, ['Gimnasio', 'Piso compartido', 'Los del curro', 'Familia']);
    const res = await bot.db.from('groups').insert({ name, emoji: '👥' }).select('id').single();
    check(res, 'crear grupo');
    // Comparte el código (como haría por WhatsApp) para que otros se unan.
    const code = await bot.db.rpc('get_group_invite_code', { p_group_id: res.data.id });
    check(code, 'get_group_invite_code');
    world.sharedCodes.push({ groupId: res.data.id, code: code.data, by: bot.persona.username });
    return `crea el grupo «${name}» y comparte su código`;
  },

  async invitarAlGrupo(bot) {
    const groups = await myActiveGroups(bot);
    const groupId = pick(bot.rng, groups);
    if (!groupId) return null;
    const friends = await bot.db
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted');
    check(friends, 'leer amigos');
    const members = new Set((await groupMembers(bot, groupId)).map((m) => m.user_id));
    const candidates = friends.data
      .map((f) => (f.requester_id === bot.id ? f.addressee_id : f.requester_id))
      .filter((id) => !members.has(id));
    const target = pick(bot.rng, candidates);
    if (!target) return null;
    const res = await bot.db.from('group_members').insert({ group_id: groupId, user_id: target });
    // Solo el líder invita: si no lo es, la app no le enseña el botón.
    if (res.error && res.error.code === '42501') return null;
    check(res, 'invitar al grupo');
    return `invita a un amigo a su grupo`;
  },

  async responderInvitacion(bot) {
    const res = await bot.db
      .from('group_members')
      .select('group_id')
      .eq('user_id', bot.id)
      .eq('status', 'invited');
    check(res, 'leer invitaciones');
    const inv = pick(bot.rng, res.data);
    if (!inv) return null;
    if (chance(bot.rng, 0.85)) {
      check(
        await bot.db
          .from('group_members')
          .update({ status: 'active' })
          .eq('group_id', inv.group_id)
          .eq('user_id', bot.id),
        'aceptar invitación',
      );
      return 'acepta una invitación a un grupo';
    }
    check(
      await bot.db
        .from('group_members')
        .delete()
        .eq('group_id', inv.group_id)
        .eq('user_id', bot.id),
      'rechazar invitación',
    );
    return 'rechaza una invitación a un grupo';
  },

  async unirsePorCodigo(bot, world) {
    const groups = await myActiveGroups(bot);
    const shared = pick(
      bot.rng,
      world.sharedCodes.filter((s) => !groups.includes(s.groupId)),
    );
    if (!shared) return null;
    // Lo escribe a mano, a veces en minúsculas o con guion.
    const typed = chance(bot.rng, 0.5)
      ? shared.code.toLowerCase()
      : `${shared.code.slice(0, 4)}-${shared.code.slice(4)}`;
    const preview = await bot.db.rpc('preview_group_by_code', { p_code: typed });
    check(preview, 'preview_group_by_code');
    if (preview.data.length === 0) {
      world.report.add('ERROR', bot, 'El código de un grupo no encuentra el grupo', {
        codigo: typed,
        compartido_por: shared.by,
      });
      return null;
    }
    check(await bot.db.rpc('join_group_by_code', { p_code: typed }), 'join_group_by_code');
    return `se une a un grupo con el código ${typed}`;
  },

  async crearContadorDeGrupo(bot) {
    const groups = await myActiveGroups(bot);
    const groupId = pick(bot.rng, groups);
    if (!groupId) return null;
    const name = pick(bot.rng, ['Flexiones', 'Cafés', 'Pasos', 'Cervezas', 'Horas de estudio']);
    const res = await bot.db
      .from('counters')
      .insert({ name, group_id: groupId, emoji: '🏆', streak_enabled: chance(bot.rng, 0.2) })
      .select('id')
      .single();
    check(res, 'crear contador de grupo');
    return `crea el contador compartido «${name}» en un grupo`;
  },

  async crearContadorComun(bot) {
    const groups = await myActiveGroups(bot);
    const groupId = pick(bot.rng, groups);
    if (!groupId) return null;
    const members = (await groupMembers(bot, groupId)).filter((m) => m.status === 'active');
    if (members.length < 2) return null;
    const res = await bot.db
      .from('counters')
      .insert({ name: 'Pizzas del grupo', group_id: groupId, is_common: true, emoji: '🍕' })
      .select('id')
      .single();
    check(res, 'crear contador común');
    check(
      await bot.db.rpc('set_counter_participants', {
        p_counter_id: res.data.id,
        p_user_ids: members.map((m) => m.user_id),
      }),
      'set_counter_participants',
    );
    return `crea un contador común con ${members.length} participantes`;
  },

  async sumarEnGrupo(bot) {
    const h = await home(bot);
    const groups = await myActiveGroups(bot);
    const c = pick(
      bot.rng,
      groupCountersOf(h, groups).filter((x) => !x.is_common),
    );
    if (!c) return null;
    const amount = pick(bot.rng, bot.persona.amounts);
    await log(bot, c.id, amount);
    return `+${amount} en el contador de grupo «${c.name}»`;
  },

  async sumarEnComun(bot) {
    const h = await home(bot);
    const c = pick(
      bot.rng,
      h.counters.filter((x) => x.is_common && x.owner_id === bot.id),
    );
    if (!c) return null;
    const amount = pick(bot.rng, [1, 1, 2]);
    check(
      await bot.db.rpc('add_to_common_counter', {
        p_counter_id: c.id,
        p_amount: amount,
        p_logged_at: new Date().toISOString(),
        p_note: null,
      }),
      'add_to_common_counter',
    );
    bot.state.loggedToday = true;
    return `+${amount} para todos en el común «${c.name}»`;
  },

  async pedirEnComun(bot) {
    const h = await home(bot);
    const c = pick(
      bot.rng,
      h.counters.filter((x) => x.is_common && x.owner_id !== bot.id),
    );
    if (!c) return null;
    const groups = await myActiveGroups(bot);
    if (!groups.includes(c.group_id)) return null;
    check(
      await bot.db.from('counter_requests').insert({ counter_id: c.id, amount: 1 }),
      'pedir en común',
    );
    return `pide +1 al administrador del común «${c.name}»`;
  },

  async decidirSolicitudes(bot) {
    const res = await bot.db
      .from('counter_requests')
      .select('id, counter_id, requester_id')
      .eq('status', 'pending')
      .neq('requester_id', bot.id);
    check(res, 'leer solicitudes de contador');
    const req = pick(bot.rng, res.data);
    if (!req) return null;
    const approve = chance(bot.rng, 0.8);
    check(
      await bot.db.rpc('decide_counter_request', { p_request_id: req.id, p_approve: approve }),
      'decide_counter_request',
    );
    return `${approve ? 'acepta' : 'rechaza'} una solicitud en un común`;
  },

  async editarParticipantes(bot) {
    const h = await home(bot);
    const c = pick(
      bot.rng,
      h.counters.filter((x) => x.is_common && x.owner_id === bot.id),
    );
    if (!c) return null;
    const members = (await groupMembers(bot, c.group_id)).filter((m) => m.status === 'active');
    const chosen = members.filter(() => chance(bot.rng, 0.7)).map((m) => m.user_id);
    if (chosen.length === 0) return null;
    check(
      await bot.db.rpc('set_counter_participants', { p_counter_id: c.id, p_user_ids: chosen }),
      'set_counter_participants',
    );
    return `cambia los participantes del común «${c.name}» (${chosen.length})`;
  },

  async mirarClasificacion(bot) {
    const h = await home(bot);
    const groups = await myActiveGroups(bot);
    const c = pick(bot.rng, groupCountersOf(h, groups));
    if (!c) return null;
    const period = pick(bot.rng, ['week', 'month', 'year', 'all']);
    check(await bot.db.rpc('get_leaderboard', { counter_id: c.id, period }), 'get_leaderboard');
    if (c.streak_enabled) {
      check(
        await bot.db.rpc('get_streak_leaderboard', { p_counter_id: c.id }),
        'get_streak_leaderboard',
      );
    }
    check(
      await bot.db.rpc('get_group_counter_daily', { p_counter_id: c.id }),
      'get_group_counter_daily',
    );
    return `mira la clasificación de «${c.name}» (${period})`;
  },

  async salirDelGrupo(bot) {
    const groups = await myActiveGroups(bot);
    const groupId = pick(bot.rng, groups);
    if (!groupId) return null;
    const res = await bot.db.rpc('leave_group', { p_group_id: groupId });
    // Si es el único miembro, la app le pide eliminar el grupo: no es un fallo.
    if (res.error && /único miembro/.test(res.error.message)) return null;
    check(res, 'leave_group');
    return 'abandona un grupo';
  },

  async designarLider(bot) {
    const res = await bot.db
      .from('group_members')
      .select('group_id')
      .eq('user_id', bot.id)
      .eq('role', 'owner')
      .eq('status', 'active');
    check(res, 'leer grupos que lidero');
    const g = pick(bot.rng, res.data);
    if (!g) return null;
    const other = pick(
      bot.rng,
      (await groupMembers(bot, g.group_id)).filter(
        (m) => m.status === 'active' && m.user_id !== bot.id,
      ),
    );
    if (!other) return null;
    check(
      await bot.db.rpc('transfer_group_admin', {
        p_group_id: g.group_id,
        p_user_id: other.user_id,
      }),
      'transfer_group_admin',
    );
    return 'pasa el liderazgo de un grupo a otro miembro';
  },

  async leerAvisos(bot) {
    const res = await bot.db.from('notifications').select('id, kind').is('read_at', null);
    check(res, 'leer avisos');
    if (res.data.length === 0) return null;
    check(
      await bot.db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null),
      'marcar avisos',
    );
    return `lee ${res.data.length} avisos (${[...new Set(res.data.map((n) => n.kind))].join(', ')})`;
  },
};
