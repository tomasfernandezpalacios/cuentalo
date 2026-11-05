// Bots de prueba: cinco usuarios reales (prueba1 … prueba5) que usan la app como lo haría una
// persona, cada uno a su manera, y apuntan los fallos e incoherencias que encuentran.
//
// Uso (desde la raíz del proyecto):
//   node --env-file=.env scripts/bots/bots.mjs            → 30 rondas
//   node --env-file=.env scripts/bots/bots.mjs --rondas 80 --semilla 7
//
// La primera vez crea las cuentas (registro normal de la app; contraseñas aleatorias que se
// guardan en scripts/bots/.bots.json, que no se sube a Git). Las siguientes, inicia sesión con
// ellas: los bots siguen con sus contadores, amigos y rachas de días anteriores.
//
// Resultado: un informe por ejecución en scripts/bots/informes/ y la lista acumulada de
// hallazgos en scripts/bots/hallazgos.md. Para borrarlo todo: scripts/bots/limpiar.mjs.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACTIONS } from './acciones.mjs';
import { checkBot } from './comprobaciones.mjs';
import { PERSONAS } from './personas.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS = join(HERE, '.bots.json');
const REPORTS = join(HERE, 'informes');
const FINDINGS = join(HERE, 'hallazgos.json');
const FINDINGS_MD = join(HERE, 'hallazgos.md');
const EMAIL_DOMAIN = 'cuentalo.test';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY. Ejecuta con --env-file=.env');
  process.exit(1);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}
const ROUNDS = arg('rondas', 30);
const SEED = arg('semilla', Math.floor(Date.now() / 1000));

/** Números aleatorios repetibles (misma semilla → mismas decisiones). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Informe -----------------------------------------------------------------------------------

const SEVERITIES = ['CRÍTICO', 'ERROR', 'AVISO', 'OBSERVACIÓN'];

class Report {
  constructor() {
    this.findings = new Map(); // título → hallazgo
    this.actions = [];
  }

  add(severity, bot, title, details = {}) {
    const key = `${severity}|${title}`;
    const existing = this.findings.get(key);
    if (existing) {
      existing.times++;
      existing.bots.add(bot.persona.username);
      return;
    }
    this.findings.set(key, {
      severity,
      title,
      details,
      times: 1,
      bots: new Set([bot.persona.username]),
      // Lo último que hizo ese bot: sirve para reproducirlo.
      steps: bot.history.slice(-6),
    });
    console.log(`  [${severity}] ${bot.persona.username}: ${title}`);
  }
}

// --- Sesiones ----------------------------------------------------------------------------------

function loadCredentials() {
  return existsSync(CREDENTIALS) ? JSON.parse(readFileSync(CREDENTIALS, 'utf8')) : {};
}

async function signIn(persona, creds, report) {
  const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `${persona.username}@${EMAIL_DOMAIN}`;
  let password = creds[persona.username];

  if (!password) {
    // Primera vez: registro como en la app (comprueba el nombre de usuario antes).
    const free = await db.rpc('is_username_available', { p_username: persona.username });
    if (free.error) throw new Error(`is_username_available: ${free.error.message}`);
    if (!free.data)
      throw new Error(`El usuario ${persona.username} ya existe pero no tengo su contraseña`);
    password = randomBytes(18).toString('base64url');
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { username: persona.username, display_name: persona.displayName } },
    });
    if (error) throw new Error(`Registro de ${persona.username}: ${error.message}`);
    if (!data.session) {
      throw new Error(
        'El registro pide confirmar el email: desactívalo en Supabase para los bots.',
      );
    }
    creds[persona.username] = password;
    writeFileSync(CREDENTIALS, JSON.stringify(creds, null, 2));
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Inicio de sesión de ${persona.username}: ${error.message}`);
  const bot = {
    persona,
    db,
    id: data.user.id,
    rng: null,
    history: [],
    state: { loggedToday: false },
  };
  // La app guarda la zona horaria del móvil al abrirse.
  const tz = await db.rpc('set_my_time_zone', { p_time_zone: persona.timeZone });
  if (tz.error)
    report.add('ERROR', bot, 'No se puede guardar la zona horaria', { error: tz.error.message });
  return bot;
}

// --- Partida -----------------------------------------------------------------------------------

function weightedPick(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = rng() * total;
  for (const [name, w] of entries) {
    x -= w;
    if (x <= 0) return name;
  }
  return entries[0][0];
}

async function act(bot, world) {
  // Hasta 4 intentos: si la acción elegida no tiene sentido ahora, elige otra.
  for (let attempt = 0; attempt < 4; attempt++) {
    const name = weightedPick(bot.rng, bot.persona.weights);
    try {
      const done = await ACTIONS[name](bot, world);
      if (done) {
        bot.history.push(`${name}: ${done}`);
        world.report.actions.push(`R${world.round} ${bot.persona.username}: ${done}`);
        world.counts[bot.persona.username] = (world.counts[bot.persona.username] ?? 0) + 1;
        return;
      }
    } catch (e) {
      bot.history.push(`${name}: ERROR`);
      world.report.add('ERROR', bot, `Falla «${name}»`, {
        error: e.message,
        codigo: e.supabase?.code,
      });
      return;
    }
  }
}

async function main() {
  const started = new Date();
  console.log(`Bots de Cuéntalo · ${ROUNDS} rondas · semilla ${SEED}`);
  const report = new Report();
  const creds = loadCredentials();

  const bots = [];
  for (const persona of PERSONAS) {
    bots.push(await signIn(persona, creds, report));
  }
  bots.forEach((b, i) => (b.rng = mulberry32(SEED * 31 + i)));

  const names = new Map(bots.map((b) => [b.id, b.persona.username]));
  const world = {
    bots,
    report,
    round: 0,
    counts: {},
    sharedCodes: [],
    codes: new Map(),
    nameOf: (id) => names.get(id) ?? 'otra persona',
    rng: mulberry32(SEED),
  };

  // Al empezar, cada uno crea su primer contador si no tiene ninguno (como en el tutorial).
  for (const bot of bots) {
    const h = await bot.db.rpc('get_my_home');
    if (!h.error && h.data.counters.length === 0) await ACTIONS.crearContador(bot, world);
  }
  // Los códigos de los grupos que ya existían (de ejecuciones anteriores) se comparten igual.
  for (const bot of bots) {
    const g = await bot.db
      .from('group_members')
      .select('group_id')
      .eq('user_id', bot.id)
      .eq('status', 'active');
    for (const { group_id } of g.data ?? []) {
      const code = await bot.db.rpc('get_group_invite_code', { p_group_id: group_id });
      if (!code.error && !world.sharedCodes.some((s) => s.groupId === group_id)) {
        world.sharedCodes.push({ groupId: group_id, code: code.data, by: bot.persona.username });
      }
    }
  }

  for (world.round = 1; world.round <= ROUNDS; world.round++) {
    // En cada ronda, en orden aleatorio, cada bot hace una cosa (los ocasionales a veces nada).
    const order = [...bots].sort(() => world.rng() - 0.5);
    for (const bot of order) {
      if (bot.persona.username === 'prueba4' && bot.rng() < 0.5) continue;
      await act(bot, world);
    }
    if (world.round % 10 === 0) console.log(`  ronda ${world.round}/${ROUNDS}`);
  }

  console.log('Comprobando que todo cuadra…');
  const summary = {};
  for (const bot of bots) {
    try {
      summary[bot.persona.username] = await checkBot(bot, world);
    } catch (e) {
      report.add('ERROR', bot, 'Las comprobaciones no han podido terminar', { error: e.message });
    }
  }

  writeReports(report, world, summary, started);
}

// --- Escribir resultados -----------------------------------------------------------------------

function fmtDetails(details) {
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

function writeReports(report, world, summary, started) {
  mkdirSync(REPORTS, { recursive: true });
  const stamp = started.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const findings = [...report.findings.values()].sort(
    (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
  );

  const lines = [
    `# Informe de los bots · ${started.toLocaleString('es-ES')}`,
    '',
    `Rondas: ${ROUNDS} · semilla: ${SEED} (con la misma semilla los bots toman las mismas decisiones).`,
    '',
    '## Resumen',
    '',
    '| Bot | Perfil | Acciones | Contadores | Registros visibles | Grupos |',
    '|---|---|---|---|---|---|',
    ...world.bots.map((b) => {
      const s = summary[b.persona.username] ?? {};
      return `| ${b.persona.username} | ${b.persona.profile} | ${world.counts[b.persona.username] ?? 0} | ${s.contadores ?? '?'} | ${s.registrosVisibles ?? '?'} | ${s.grupos ?? '?'} |`;
    }),
    '',
    `## Hallazgos (${findings.length})`,
    '',
  ];
  if (findings.length === 0) lines.push('Ninguno: todo cuadra. 🎉', '');
  for (const f of findings) {
    lines.push(
      `### [${f.severity}] ${f.title}`,
      '',
      `- Visto ${f.times} ${f.times === 1 ? 'vez' : 'veces'} por: ${[...f.bots].join(', ')}`,
      `- Detalles: ${fmtDetails(f.details) || '—'}`,
      `- Lo último que hizo antes: ${f.steps.join(' → ') || '—'}`,
      '',
    );
  }
  lines.push('## Registro de acciones', '', '```', ...report.actions, '```', '');
  const file = join(REPORTS, `${stamp}.md`);
  writeFileSync(file, lines.join('\n'));

  // Lista acumulada: cada hallazgo una vez, con cuándo se vio por primera y última vez.
  const all = existsSync(FINDINGS) ? JSON.parse(readFileSync(FINDINGS, 'utf8')) : {};
  for (const f of findings) {
    const key = `${f.severity}|${f.title}`;
    const prev = all[key];
    all[key] = {
      severity: f.severity,
      title: f.title,
      details: fmtDetails(f.details),
      first: prev?.first ?? started.toISOString(),
      last: started.toISOString(),
      runs: (prev?.runs ?? 0) + 1,
      status: prev?.status ?? 'abierto',
    };
  }
  writeFileSync(FINDINGS, JSON.stringify(all, null, 2));
  const md = [
    '# Hallazgos de los bots',
    '',
    'Lista acumulada de todas las ejecuciones (la genera `bots.mjs`). Para marcar uno como',
    'resuelto, cambia su `status` en `hallazgos.json`.',
    '',
    '| Gravedad | Hallazgo | Detalles | Ejecuciones | Última vez | Estado |',
    '|---|---|---|---|---|---|',
    ...Object.values(all)
      .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
      .map(
        (f) =>
          `| ${f.severity} | ${f.title} | ${f.details.replace(/\|/g, '/')} | ${f.runs} | ${f.last.slice(0, 10)} | ${f.status} |`,
      ),
    '',
  ];
  writeFileSync(FINDINGS_MD, md.join('\n'));

  console.log(`\nHallazgos: ${findings.length}. Informe: ${file}`);
}

main().catch((e) => {
  console.error(`\nNo se ha podido terminar: ${e.message}`);
  process.exit(1);
});
