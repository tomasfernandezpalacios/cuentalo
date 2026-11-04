import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

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

let lastKey = '';
let activeDay = '';

async function schedule(activeToday: boolean) {
  const { reminder } = getSettings();
  const today = localToday();
  const key = reminder.enabled
    ? `${today}|${reminder.hour}:${reminder.minute}|${activeToday}`
    : 'off';
  if (key === lastKey) return;
  lastKey = key;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!reminder.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannel();
  for (const date of reminderDates(new Date(), reminder.hour, reminder.minute, activeToday)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '¡No pierdas tu racha! 🔥',
        body: 'Aún no has registrado nada hoy en Cuéntalo.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
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
 * se refresca al volver a la app); sin sesión, ninguno.
 */
export function useReminderSync(isSignedIn: boolean) {
  const { reminder } = useSettings();
  const streak = useStreak();
  const activeToday = streak.data?.days.has(localToday()) ?? false;
  const ready = streak.data !== undefined;

  useEffect(() => {
    if (!isSignedIn) {
      clearReminders();
      return;
    }
    if (!ready) return;
    if (activeToday) activeDay = localToday();
    syncReminder(activeToday);
  }, [isSignedIn, ready, activeToday, reminder.enabled, reminder.hour, reminder.minute]);
}
