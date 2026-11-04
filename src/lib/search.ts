/** Quita tildes y mayúsculas para buscar «cafe» y encontrar «Café». */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** ¿Contiene el nombre la búsqueda (sin tildes ni mayúsculas)? Una búsqueda vacía vale todo. */
export function matchesSearch(name: string, query: string): boolean {
  const q = normalizeSearch(query);
  return q === '' || normalizeSearch(name).includes(q);
}
