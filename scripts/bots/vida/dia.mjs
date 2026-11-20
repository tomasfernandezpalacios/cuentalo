// Un rato de uso de los bots con vida: apuntan lo que les toca desde la última vez (si el
// ordenador estuvo apagado, se ponen al día), contestan solicitudes e invitaciones, el
// administrador del común decide las peticiones, leen sus avisos y, si eres amigo de quien
// lidera un grupo, te invitan. Si estás en grupos con ellos, también apuntan en tus contadores.
//
// Uso: node --env-file=.env scripts/bots/vida/dia.mjs   (lo lanza la tarea programada)

import {
  addDays,
  check,
  loadState,
  lookupWorld,
  planDay,
  rngFor,
  saveState,
  sendDay,
  signInAll,
  todayMadrid,
} from './comun.mjs';
import { GROUPS, HUMAN } from './mundo.mjs';

const state = loadState();
if (!state.sentUntil) {
  console.log('Primero hay que sembrar el mundo (sembrar.mjs).');
  process.exit(1);
}
state.invited ??= {};

const now = new Date();
const since = new Date(state.sentUntil);
const today = todayMadrid(now);
console.log(
  `Bots con vida · ${now.toLocaleString('es-ES')} · desde ${since.toLocaleString('es-ES')}`,
);

const bots = await signInAll();
const ids = await lookupWorld(bots);
const worldGroups = new Set(Object.values(ids.groups));

for (const b of Object.values(bots)) {
  // Contestar solicitudes de amistad de gente de fuera (las acepta: son gente maja). Las que
  // hay entre ellos están fijadas en mundo.mjs (Daniel aún no contesta a Carla).
  const botIds = new Set(Object.values(bots).map((x) => x.id));
  const reqs = check(
    await b.db
      .from('friendships')
      .select('id, requester_id')
      .eq('addressee_id', b.id)
      .eq('status', 'pending'),
    'solicitudes',
  ).filter((r) => !botIds.has(r.requester_id));
  for (const r of reqs) {
    check(await b.db.from('friendships').update({ status: 'accepted' }).eq('id', r.id), 'aceptar');
    console.log(`  ${b.username} acepta una solicitud de amistad`);
  }
  // Aceptar invitaciones a grupos.
  const invs = check(
    await b.db.from('group_members').select('group_id').eq('user_id', b.id).eq('status', 'invited'),
    'invitaciones',
  );
  for (const i of invs) {
    check(
      await b.db
        .from('group_members')
        .update({ status: 'active' })
        .eq('group_id', i.group_id)
        .eq('user_id', b.id),
      'aceptar invitación',
    );
    console.log(`  ${b.username} se une a un grupo al que le han invitado`);
  }
  // Decidir peticiones en los comunes que administra.
  const pending = check(
    await b.db
      .from('counter_requests')
      .select('id, counter_id, counters!inner(owner_id)')
      .eq('status', 'pending')
      .eq('counters.owner_id', b.id),
    'peticiones',
  );
  for (const p of pending) {
    check(
      await b.db.rpc('decide_counter_request', { p_request_id: p.id, p_approve: true }),
      'decidir petición',
    );
    console.log(`  ${b.username} acepta una petición en un común`);
  }
}

// Invitarte a sus grupos si ya sois amigos (una sola vez por grupo).
const human = check(
  await bots.prueba1.db.from('profiles').select('id').eq('username', HUMAN),
  'buscar tu cuenta',
)[0];
if (human) {
  for (const g of GROUPS.filter((x) => x.inviteHuman && !state.invited[x.key])) {
    const owner = bots[g.owner];
    const friends = check(
      await owner.db
        .from('friendships')
        .select('id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${human.id},addressee_id.eq.${human.id}`),
      'amistad contigo',
    );
    if (friends.length === 0) continue;
    const res = await owner.db
      .from('group_members')
      .insert({ group_id: ids.groups[g.key], user_id: human.id });
    if (res.error && res.error.code !== '23505') console.log(`  invitarte: ${res.error.message}`);
    state.invited[g.key] = true;
    console.log(`  ${owner.username} te invita a «${g.name}»`);
  }
}

// Lo que apuntan desde la última vez.
for (const b of Object.values(bots)) {
  let sent = 0;
  for (let day = todayMadrid(since); day <= today; day = addDays(day, 1)) {
    const items = planDay(b.username, day, now).filter((i) => i.at > since);
    sent += await sendDay(b, items, ids);

    // En tus grupos (contadores que no son del mundo), de vez en cuando suman algo.
    const r = rngFor(`${b.username}|humano|${day}`);
    if (day !== today || !r.p(0.35)) continue;
    const home = check(await b.db.rpc('get_my_home'), 'get_my_home');
    const yours = home.counters.filter(
      (c) => c.group_id && !worldGroups.has(c.group_id) && !c.is_common,
    );
    if (yours.length === 0) continue;
    const c = r.pick(yours);
    const amount = r.int(1, 2);
    const res = await b.db.rpc('log_to_counter', {
      p_counter_id: c.id,
      p_amount: amount,
      p_logged_at: now.toISOString(),
      p_note: null,
    });
    if (!res.error) {
      sent++;
      console.log(`  ${b.username}: +${amount} en tu contador «${c.name}»`);
    }
  }
  // Abren la app: leen sus avisos.
  await b.db.from('notifications').update({ read_at: now.toISOString() }).is('read_at', null);
  console.log(`  ${b.username}: ${sent} registros`);
}

state.sentUntil = now.toISOString();
saveState(state);
console.log('Listo.');
