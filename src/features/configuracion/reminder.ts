import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useCounterList } from '@/features/contadores/hooks';
import { useStreak } from '@/features/estadisticas/api';
import { localToday } from '@/features/estadisticas/periods';

import { reminderDates } from './reminderDates';
import { getSettings, useSettings } from './settings';

// Recordatorio diario para no perder la racha, con notificaciones locales (funcionan en Expo
// Go; las push desde el servidor necesitarían una build propia).
//
// En vez de una notificación que se repite cada día, se programan las de los próximos días
// (DAYS_AHEAD) una a una. Así se puede saltar la de hoy si ya has registrado algo: el aviso
// solo llega cuando de verdad te falta. Se reprograman al abrir la app y al registrar.

const CHANNEL_ID = 'recordatorios';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** Pide permiso para notificaciones. Devuelve si se puede avisar. */
export async function requestReminderPermission(): Promise<boolean> {
  // En Android 13+ el permiso no se pide hasta que existe algún canal.
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Contador en formato racha para el que puede tocar recordatorio. */
export type StreakCounterReminder = { id: string; name: string; todayDone: boolean };

// iOS deja programar como mucho 64 avisos a la vez: se reparten entre el general y los de cada
// contador (menos días por adelantado cuantos más contadores).
const MAX_SCHEDULED = 60;

let lastKey = '';
let activeDay = '';
let streakCounters: StreakCounterReminder[] = [];

async function scheduleAt(dates: Date[], title: string, body: string) {
  for (const date of dates) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  }
}

async function schedule(activeToday: boolean) {
  const { reminder } = getSettings();
  const today = localToday();
  const counters = reminder.counters ? streakCounters : [];
  const key =
    reminder.enabled || counters.length > 0
      ? `${today}|${reminder.hour}:${reminder.minute}|${reminder.enabled}|${activeToday}|` +
        counters.map((c) => `${c.id}:${c.name}:${c.todayDone}`).join(',')
      : 'off';
  if (key === lastKey) return;
  lastKey = key;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (key === 'off') return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannel();

  const kinds = Number(reminder.enabled) + counters.length;
  const days = Math.max(1, Math.min(14, Math.floor(MAX_SCHEDULED / Math.max(kinds, 1))));
  const now = new Date();
  if (reminder.enabled) {
    await scheduleAt(
      reminderDates(now, reminder.hour, reminder.minute, activeToday, days),
      '¡No pierdas tu racha! 🔥',
      'Aún no has registrado nada hoy en Cuéntalo.',
    );
  }
  // Uno por contador de racha: solo los días en que aún no se ha mantenido.
  for (const counter of counters) {
    await scheduleAt(
      reminderDates(now, reminder.hour, reminder.minute, counter.todayDone, days),
      `🔥 ${counter.name}`,
      `Hoy aún no has apuntado «${counter.name}». ¡No pierdas la racha!`,
    );
  }
}

/** Reprograma los avisos (p. ej. al cambiar la hora en Configuración). */
export function syncReminder(activeToday = activeDay === localToday()) {
  schedule(activeToday).catch(() => {
    // Sin permiso o sin notificaciones en este dispositivo: no hay recordatorio.
    lastKey = '';
  });
}

/** Al registrar algo: hoy ya no hace falta recordatorio. */
export function markActiveToday() {
  activeDay = localToday();
  syncReminder(true);
}

/** Quita todos los avisos (al cerrar sesión). */
export function clearReminders() {
  lastKey = 'off';
  Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/**
 * Mantiene los avisos al día con la sesión: con sesión, según los días con registros (la racha
 * se refresca al volver a la app) y mis contadores de racha; sin sesión, ninguno.
 */
export function useReminderSync(isSignedIn: boolean) {
  const { reminder } = useSettings();
  const streak = useStreak();
  const counters = useCounterList();
  const activeToday = streak.data?.days.has(localToday()) ?? false;
  const ready = streak.data !== undefined;
  const counterList = useMemo<StreakCounterReminder[]>(
    () =>
      (counters.data ?? [])
        .filter((c) => c.streak && c.isActive && !c.linkedInto)
        .map((c) => ({ id: c.id, name: c.name, todayDone: c.streak?.todayDone ?? false })),
    [counters.data],
  );

  useEffect(() => {
    if (!isSignedIn) {
      clearReminders();
      return;
    }
    if (!ready) return;
    if (activeToday) activeDay = localToday();
    // schedule() compara con lo ya programado y no repite si nada ha cambiado.
    streakCounters = counterList;
    syncReminder(activeToday);
  }, [
    isSignedIn,
    ready,
    activeToday,
    counterList,
    reminder.enabled,
    reminder.counters,
    reminder.hour,
    reminder.minute,
  ]);
}
