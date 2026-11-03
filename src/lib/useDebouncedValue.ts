import { useEffect, useState } from 'react';

/** Devuelve el valor solo cuando deja de cambiar durante `delay` ms (p. ej. al escribir). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
