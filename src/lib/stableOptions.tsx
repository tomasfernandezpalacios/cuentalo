import { useLayoutEffect, useMemo, useRef } from 'react';
import { Stack } from 'expo-router';

/**
 * Opciones de cabecera estables para `<Stack.Screen options={…} />` dentro de las pestañas.
 *
 * `Stack.Screen` llama a `setOptions` cada vez que cambia el objeto de opciones, y en las
 * pestañas como páginas (`TopTabs`) cada `setOptions` vuelve a dibujar la página: si las opciones
 * se crean nuevas en cada render, es un bucle infinito («Maximum update depth exceeded»). Aquí el
 * objeto solo cambia cuando cambia `key` (lo que se ve en la cabecera); las funciones
 * (`headerRight`, `headerTitle`…) llaman siempre a la versión más reciente, así los botones no
 * usan datos viejos.
 */
export function useStableOptions<T extends Record<string, unknown>>(options: T, key: string): T {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  return useMemo(() => {
    const stable: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(options)) {
      stable[name] =
        typeof value === 'function'
          ? (...args: unknown[]) => (latest.current[name] as (...a: unknown[]) => unknown)(...args)
          : value;
    }
    return stable as T;
    // Solo se rehace cuando cambia lo que se ve (`key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * `<Stack.Screen options={…} />` con opciones estables (`useStableOptions`). Es un componente
 * para poder usarlo también después de un `return` temprano de la pantalla.
 */
export function StableScreenOptions({
  options,
  optionsKey,
}: {
  options: Record<string, unknown>;
  optionsKey: string;
}) {
  return <Stack.Screen options={useStableOptions(options, optionsKey)} />;
}
