import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// Ajustes de este móvil (no van a Supabase): apariencia, botones, avisos… Se guardan en
// SecureStore como un JSON pequeño y se leen de forma síncrona al arrancar, así el tema
// elegido se aplica desde el primer fotograma.

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentName = 'morado' | 'azul' | 'verde' | 'naranja' | 'rosa';
/**
 * Estilo visual de toda la app: 'clasico' (el morado de siempre) o 'cine' (prueba: oscuro
 * cálido, dorado y tipografía editorial). Se aplica al arrancar la app.
 */
export type VisualStyle = 'clasico' | 'cine';
/** Cómo se ven los contadores en «Mis contadores»: filas (de serie) o bloques, dos por fila. */
export type CounterLayout = 'list' | 'grid';
/** Un color de serie o el personalizado (`customAccent`). */
export type AccentChoice = AccentName | 'custom';

export type Settings = {
  theme: ThemeMode;
  visualStyle: VisualStyle;
  counterLayout: CounterLayout;
  accent: AccentChoice;
  /** Color elegido a mano ('#RRGGBB'), para accent = 'custom'. */
  customAccent: string;
  /** Cantidades de los botones rápidos (de 1 a 3, ordenadas). */
  quickAmounts: number[];
  /** Pedir confirmación antes de restar 1. */
  confirmRemove: boolean;
  /** Vibración suave al registrar. */
  haptics: boolean;
  /** Contador que se dibuja al abrir Estadísticas: 'last' (el último usado) o su id. */
  statsDefault: string;
  /**
   * Recordatorios diarios: el de la racha de uso (enabled) y, aparte, uno por cada contador de
   * racha que aún no se haya mantenido ese día (counters). Misma hora para todos.
   */
  reminder: { enabled: boolean; counters: boolean; hour: number; minute: number };
  /**
   * Antiguo: la fecha de nacimiento se guardaba aquí (solo en el móvil). Ahora va en la cuenta
   * (profile_private); si queda una aquí, useBirthDate la sube una vez y la borra.
   */
  birthDate: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  visualStyle: 'clasico',
  counterLayout: 'list',
  accent: 'morado',
  customAccent: '#5B4BDB',
  quickAmounts: [1, 5],
  confirmRemove: false,
  haptics: true,
  statsDefault: 'last',
  reminder: { enabled: false, counters: false, hour: 21, minute: 0 },
  birthDate: null,
};

/** Cantidades que se pueden elegir para los botones rápidos. */
export const QUICK_AMOUNT_OPTIONS = [1, 2, 3, 5, 10, 20, 50, 100] as const;
export const MAX_QUICK_AMOUNTS = 3;

const STORAGE_KEY = 'cuentalo.settings';

/** Mezcla lo guardado con los valores por defecto, descartando lo que no tenga sentido. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(raw) as Partial<Settings>;
    const amounts = Array.isArray(saved.quickAmounts)
      ? saved.quickAmounts.filter((n) => Number.isInteger(n) && n > 0)
      : [];
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      quickAmounts:
        amounts.length > 0
          ? [...new Set(amounts)].sort((a, b) => a - b).slice(0, MAX_QUICK_AMOUNTS)
          : DEFAULT_SETTINGS.quickAmounts,
      reminder: { ...DEFAULT_SETTINGS.reminder, ...saved.reminder },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function load(): Settings {
  try {
    return parseSettings(SecureStore.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: Settings = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  listeners.forEach((listener) => listener());
  try {
    SecureStore.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Si no se puede guardar, el ajuste dura hasta cerrar la app.
  }
}

/** Ajustes actuales; el componente se vuelve a pintar cuando cambian. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/** Añade o quita una cantidad de los botones rápidos (siempre queda al menos una). */
export function toggleQuickAmount(amounts: number[], amount: number): number[] {
  if (amounts.includes(amount)) {
    return amounts.length > 1 ? amounts.filter((a) => a !== amount) : amounts;
  }
  if (amounts.length >= MAX_QUICK_AMOUNTS) return amounts;
  return [...amounts, amount].sort((a, b) => a - b);
}
