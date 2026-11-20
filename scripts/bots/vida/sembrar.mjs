// Crea el mundo de los bots con vida (perfiles, amistades, grupos, contadores y carpetas) y
// apunta de golpe todo lo que habrían hecho desde START hasta ahora. Solo una vez: después,
// `dia.mjs` sigue cada día.
//
// Uso: node --env-file=.env scripts/bots/vida/sembrar.mjs
// Después conviene ajustar las fechas de creación (ver README.md: «fechas.sql»).

import {
  addDays,
  check,
  loadState,
  lookupWorld,
  planDay,
  saveState,
  sendDay,
  signInAll,
  todayMadrid,
} from './comun.mjs';
import { COUNTERS, FOLDERS, FRIENDSHIPS, GROUPS, HUMAN, PEOPLE, START } from './mundo.mjs';

const state = loadState();
if (state.sentUntil) {
  console.log('El mundo ya está sembrado. Para seguir, usa dia.mjs.');
  process.exit(0);
}

const bots = await signInAll();
console.log('Sesiones iniciadas.');

// Perfiles
for (const [username, p] of Object.entries(PEOPLE)) {
  const b = bots[username];
  check(
    await b.db
      .from('profiles')
      .update({ display_name: p.name, emoji: p.emoji, tutorial_done: true })
      .eq('id', b.id),
    'perfil',
  );
}

// Amistades
for (const [from, to, accepted] of FRIENDSHIPS) {
  const res = await bots[from].db
    .from('friendships')
    .insert({ addressee_id: bots[to].id })
    .select('id')
    .single();
  const row = check(res, `amistad ${from}→${to}`);
  if (accepted) {
    check(
      await bots[to].db.from('friendships').update({ status: 'accepted' }).eq('id', row.id),
      'aceptar amistad',
    );
  }
}
console.log('Amistades hechas.');

// Grupos
const groupIds = {};
for (const g of GROUPS) {
  const owner = bots[g.owner];
  const row = check(
    await owner.db.from('groups').insert({ name: g.name, emoji: g.emoji }).select('id').single(),
    `grupo ${g.name}`,
  );
  groupIds[g.key] = row.id;
  for (const m of g.members) {
    check(
      await owner.db.from('group_members').insert({ group_id: row.id, user_id: bots[m].id }),
      'invitar',
    );
    check(
      await bots[m].db
        .from('group_members')
        .update({ status: 'active' })
        .eq('group_id', row.id)
        .eq('user_id', bots[m].id),
      'aceptar invitación',
    );
  }
}
console.log('Grupos hechos.');

// Contadores
for (const c of COUNTERS) {
  const owner = bots[c.owner];
  const row = check(
    await owner.db
      .from('counters')
      .insert({
        name: c.name,
        emoji: c.emoji,
        unit: c.unit,
        group_id: c.group ? groupIds[c.group] : null,
        is_common: Boolean(c.common),
      })
      .select('id')
      .single(),
    `contador ${c.name}`,
  );
  // Los que antes eran «formato racha»: su dueño ve la racha junto al nombre.
  if (c.streak) {
    check(
      await owner.db.from('shown_counter_streaks').insert({ counter_id: row.id }),
      'mostrar racha',
    );
  }
  if (c.common) {
    const g = GROUPS.find((x) => x.key === c.group);
    const people = [g.owner, ...g.members].map((u) => bots[u].id);
    check(
      await owner.db.rpc('set_counter_participants', {
        p_counter_id: row.id,
        p_user_ids: people,
      }),
      'participantes',
    );
  }
}
const ids = await lookupWorld(bots);
console.log(`Contadores hechos: ${Object.keys(ids.counters).length}.`);

// Carpetas
for (const f of FOLDERS) {
  check(
    await bots[f.owner].db.rpc('save_folder', {
      p_folder_id: null,
      p_name: f.name,
      p_counter_ids: f.counters.map((k) => ids.counters[k]),
    }),
    'carpeta',
  );
}

// Solicitudes de amistad a tu cuenta
const human = check(
  await bots.prueba1.db.from('profiles').select('id').eq('username', HUMAN),
  'buscar tu cuenta',
)[0];
if (human) {
  for (const b of Object.values(bots)) {
    const res = await b.db.from('friendships').insert({ addressee_id: human.id });
    if (res.error) console.log(`  ${b.username} → ${HUMAN}: ${res.error.message}`);
  }
  console.log(`Solicitudes de amistad enviadas a @${HUMAN}.`);
}

// Dos meses de registros (cada bot a la vez, día a día)
const now = new Date();
const today = todayMadrid(now);
const totals = await Promise.all(
  Object.values(bots).map(async (b) => {
    let sent = 0;
    for (let day = START; day <= today; day = addDays(day, 1)) {
      sent += await sendDay(b, planDay(b.username, day, now), ids);
    }
    console.log(`  ${b.username}: ${sent} registros`);
    return sent;
  }),
);

saveState({ sentUntil: now.toISOString(), invited: {} });
console.log(`Listo: ${totals.reduce((a, b) => a + b, 0)} registros desde el ${START}.`);
