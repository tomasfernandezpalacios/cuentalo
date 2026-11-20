// Piezas comunes de los bots con vida: sesiones, fechas en la hora de Madrid, números
// aleatorios repetibles y la simulación de un día (lo que cada uno apunta).

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTERS, EMAIL_DOMAIN, GROUPS, PEOPLE, START, TIME_ZONE } from './mundo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS = join(HERE, '..', '.bots.json');
const STATE = join(HERE, '.estado.json');

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function check({ error, data }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// --- Estado (último día simulado, invitaciones ya enviadas…) -----------------------------------

export function loadState() {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
}
export function saveState(state) {
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

// --- Sesiones ----------------------------------------------------------------------------------

export async function signInAll() {
  if (!URL || !KEY) throw new Error('Faltan las variables de .env (ejecuta con --env-file=.env)');
  if (!existsSync(CREDENTIALS)) throw new Error('No existe scripts/bots/.bots.json');
  const creds = JSON.parse(readFileSync(CREDENTIALS, 'utf8'));
  const bots = {};
  for (const username of Object.keys(PEOPLE)) {
    const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.auth.signInWithPassword({
      email: `${username}@${EMAIL_DOMAIN}`,
      password: creds[username],
    });
    if (error) throw new Error(`Inicio de sesión de ${username}: ${error.message}`);
    check(await db.rpc('set_my_time_zone', { p_time_zone: TIME_ZONE }), 'set_my_time_zone');
    bots[username] = { username, db, id: data.user.id };
  }
  return bots;
}

/** Ids de grupos y contadores del mundo (por nombre y dueño), vistos por su dueño. */
export async function lookupWorld(bots) {
  const groups = {};
  for (const g of GROUPS) {
    const owner = bots[g.owner];
    const rows = check(
      await owner.db.from('groups').select('id').eq('name', g.name).eq('owner_id', owner.id),
      'buscar grupo',
    );
    if (rows[0]) groups[g.key] = rows[0].id;
  }
  const counters = {};
  for (const c of COUNTERS) {
    const owner = bots[c.owner];
    let q = owner.db.from('counters').select('id').eq('name', c.name).eq('owner_id', owner.id);
    q = c.group ? q.eq('group_id', groups[c.group]) : q.is('group_id', null);
    const rows = check(await q, 'buscar contador');
    if (rows[0]) counters[c.key] = rows[0].id;
  }
  return { groups, counters };
}

// --- Fechas ------------------------------------------------------------------------------------

export function addDays(day, k) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

export function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function todayMadrid(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

/** Diferencia (ms) entre la hora de Madrid y la UTC en el instante `ts`. */
function offsetAt(ts) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Instante del día `day` a la hora decimal `hour` de Madrid. */
export function madridInstant(day, hour) {
  const [y, m, d] = day.split('-').map(Number);
  const minutes = Math.min(Math.round(hour * 60), 24 * 60 - 1);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  return new Date(guess - offsetAt(guess));
}

// --- Azar repetible ----------------------------------------------------------------------------

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

export function rngFor(seedText) {
  let a = hash(seedText);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    p: (prob) => next() < prob,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    hour: (from, to) => from + next() * (to - from),
  };
}

// --- Un día ------------------------------------------------------------------------------------

/**
 * Lo que apunta `username` el día `day`: lista de { counter, amount, at }. Mismo día y persona
 * → siempre lo mismo. Si es hoy, solo lo que ya ha pasado (hasta `now`).
 */
export function planDay(username, day, now = new Date()) {
  const index = dayDiff(START, day);
  if (index < PEOPLE[username].start) return [];
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const ctx = { day: index, weekday, weekend: weekday === 0 || weekday === 6 };
  const out = [];
  for (const c of COUNTERS) {
    const plan = c.plan[username];
    if (!plan) continue;
    const r = rngFor(`${username}|${c.key}|${day}`);
    for (const [amount, hour] of plan(r, ctx)) {
      const at = madridInstant(day, hour);
      if (at <= now) out.push({ counter: c, amount, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Envía a Supabase lo de un día, igual que la app (log_to_counter / add_to_common_counter). */
export async function sendDay(bot, items, ids) {
  let sent = 0;
  for (const { counter, amount, at } of items) {
    const id = ids.counters[counter.key];
    if (!id) continue;
    const fn = counter.common ? 'add_to_common_counter' : 'log_to_counter';
    const res = await bot.db.rpc(fn, {
      p_counter_id: id,
      p_amount: amount,
      p_logged_at: at.toISOString(),
      p_note: null,
    });
    if (res.error) console.log(`  ${bot.username} · ${counter.name}: ${res.error.message}`);
    else sent++;
  }
  return sent;
}
