// Borra las cuentas de los bots (prueba1 … prueba5) y todo lo suyo, igual que «Eliminar cuenta»
// en la app (delete_my_account): sus grupos pasan a otro miembro o se borran, y sus registros
// desaparecen. Sin service_role: cada bot inicia sesión y borra la suya.
//
// Uso: node --env-file=.env scripts/bots/limpiar.mjs

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS = join(HERE, '.bots.json');

if (!existsSync(CREDENTIALS)) {
  console.log('No hay bots que borrar (no existe scripts/bots/.bots.json).');
  process.exit(0);
}
const creds = JSON.parse(readFileSync(CREDENTIALS, 'utf8'));

for (const [username, password] of Object.entries(creds)) {
  const db = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const login = await db.auth.signInWithPassword({ email: `${username}@cuentalo.test`, password });
  if (login.error) {
    console.log(`${username}: no se puede iniciar sesión (${login.error.message})`);
    continue;
  }
  const res = await db.rpc('delete_my_account');
  console.log(`${username}: ${res.error ? `error (${res.error.message})` : 'cuenta borrada'}`);
}
rmSync(CREDENTIALS);
console.log('Listo. Los informes de scripts/bots/ se conservan.');
