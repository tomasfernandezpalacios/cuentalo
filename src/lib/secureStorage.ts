import * as SecureStore from 'expo-secure-store';

// SecureStore en Android avisa (y puede fallar) con valores de más de 2048 bytes, y una sesión de
// Supabase suele rondar ese tamaño. Por eso guardamos el valor troceado en varias claves.
const CHUNK_SIZE = 1800;

export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [''];
}

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function getItem(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  if (!count) return null;

  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
  );
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

async function removeItem(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  await Promise.all(
    Array.from({ length: count || 0 }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
  );
  await SecureStore.deleteItemAsync(countKey(key));
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key);
  const chunks = splitIntoChunks(value);
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
  await SecureStore.setItemAsync(countKey(key), String(chunks.length));
}

/** Adaptador de almacenamiento para supabase-js que guarda la sesión cifrada por el sistema. */
export const chunkedSecureStorage = { getItem, setItem, removeItem };
