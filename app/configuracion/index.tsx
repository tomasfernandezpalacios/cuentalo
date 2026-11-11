import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { useStartTutorial } from '@/features/tutorial/useTutorialAutoStart';
import { useMutation } from '@tanstack/react-query';
import { reloadAppAsync } from 'expo';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { signOut } from '@/features/auth/api';
import { useUserId } from '@/features/auth/AuthProvider';
import {
  OptionChips,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
} from '@/features/configuracion/components';
import { ColorPickerDialog } from '@/features/configuracion/ColorPickerDialog';
import { requestReminderPermission } from '@/features/configuracion/reminder';
import {
  type AccentChoice,
  type AccentName,
  MAX_QUICK_AMOUNTS,
  QUICK_AMOUNT_OPTIONS,
  type ThemeMode,
  type VisualStyle,
  toggleQuickAmount,
  updateSettings,
  useSettings,
} from '@/features/configuracion/settings';
import { useCounterList } from '@/features/contadores/hooks';
import {
  exportMyEntriesCsv,
  useDeleteAccount,
  useProfile,
  useUpdatePrivacy,
  type PrivacySettings,
} from '@/features/perfil/api';
import { getErrorMessage } from '@/lib/errors';
import {
  accents,
  customAccentColors,
  fonts,
  isCinema,
  useColorMode,
  useThemeColors,
} from '@/lib/theme';

const STYLES: { value: VisualStyle; label: string }[] = [
  { value: 'clasico', label: 'Clásico' },
  { value: 'cine', label: 'Cine (prueba)' },
];

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Configuración: apariencia, contadores, avisos, privacidad, cuenta e información. */
export default function SettingsScreen() {
  const colors = useThemeColors();
  const mode = useColorMode();
  const settings = useSettings();
  const [pickingColor, setPickingColor] = useState(false);
  const userId = useUserId();
  const profile = useProfile(userId);
  const privacy = useUpdatePrivacy();
  const counters = useCounterList();
  const deleteAccount = useDeleteAccount();
  const startTutorial = useStartTutorial();
  const logout = useMutation({
    mutationFn: signOut,
    onError: (error) => appAlert('Error', getErrorMessage(error)),
  });
  const exportData = useMutation({
    mutationFn: () => exportMyEntriesCsv(userId),
    onSuccess: (csv) => Share.share({ title: 'Mis registros de Cuéntalo', message: csv }),
    onError: (error) => appAlert('No se han podido exportar', getErrorMessage(error)),
  });

  const statsCounter = (counters.data ?? []).find((c) => c.id === settings.statsDefault);
  const { reminder } = settings;
  const reminderTime = new Date(2000, 0, 1, reminder.hour, reminder.minute);

  function setPrivacy(patch: Partial<PrivacySettings>) {
    privacy.mutate(patch, {
      onError: (error) => appAlert('No se ha podido guardar', getErrorMessage(error)),
    });
  }

  /** Activa o desactiva uno de los recordatorios (pide permiso la primera vez). */
  async function toggleReminder(which: 'enabled' | 'counters', value: boolean) {
    if (value && !(await requestReminderPermission())) {
      appAlert(
        'Notificaciones desactivadas',
        'Para recibir el recordatorio, permite las notificaciones de la app en los ajustes del móvil.',
      );
      return;
    }
    updateSettings({ reminder: { ...reminder, [which]: value } });
  }

  function setReminderTime(date: Date) {
    updateSettings({ reminder: { ...reminder, hour: date.getHours(), minute: date.getMinutes() } });
  }

  function openAndroidTimePicker() {
    DateTimePickerAndroid.open({
      value: reminderTime,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_event, date) => setReminderTime(date),
    });
  }

  /**
   * Las tipografías, formas y colores del estilo se fijan al arrancar: se guarda y se reinicia la
   * app (si no se reinicia ahora, se aplica la próxima vez que se abra).
   */
  function changeStyle(visualStyle: VisualStyle) {
    if (visualStyle === settings.visualStyle) return;
    updateSettings({ visualStyle });
    appAlert('Cambiar estilo', 'Para ver el nuevo estilo hay que reiniciar la app.', [
      { text: 'Más tarde', style: 'cancel' },
      { text: 'Reiniciar ahora', onPress: () => void reloadAppAsync('Cambio de estilo') },
    ]);
  }

  function confirmDelete() {
    appAlert(
      'Eliminar cuenta',
      'Se borrarán para siempre tu perfil, tus contadores privados, todos tus registros y tus ' +
        'amistades. Los grupos de los que eres líder pasarán a otro miembro (o se borrarán si estás ' +
        'solo). Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          // Segunda confirmación: es irreversible.
          onPress: () =>
            appAlert('¿Seguro?', 'Tu cuenta se eliminará ahora mismo.', [
              { text: 'No, mantenerla', style: 'cancel' },
              {
                text: 'Eliminar mi cuenta',
                style: 'destructive',
                onPress: () =>
                  deleteAccount.mutate(undefined, {
                    onError: (error) => appAlert('Error', getErrorMessage(error)),
                  }),
              },
            ]),
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <SettingsGroup title="Perfil">
        <Pressable
          onPress={() => router.push('/perfil/editar')}
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
          accessibilityHint="Cambia tu nombre, tu usuario y tu imagen de perfil"
          style={({ pressed }) => [styles.profile, { opacity: pressed ? 0.6 : 1 }]}
        >
          <PersonAvatar
            name={profile.data?.display_name ?? ''}
            emoji={profile.data?.emoji ?? null}
            photoPath={profile.data?.photo_path ?? null}
            size={56}
          />
          <View style={styles.flex}>
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
              {profile.data?.display_name ?? ''}
            </Text>
            <Text style={[styles.muted, { color: colors.textMuted }]} numberOfLines={1}>
              {profile.data ? `@${profile.data.username} · ` : ''}Editar perfil y foto
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </SettingsGroup>

      <SettingsGroup title="Apariencia">
        <SettingsRow
          first
          label="Estilo"
          detail="Cine es un estilo de prueba: oscuro cálido, dorado y letra editorial. Al cambiarlo, la app se reinicia."
          below={
            <OptionChips
              options={STYLES}
              isSelected={(v) => v === settings.visualStyle}
              onPress={changeStyle}
            />
          }
        />
        {/* El estilo Cine tiene su propio tema (oscuro) y color (dorado). */}
        {!isCinema && (
          <>
            <SettingsRow
              label="Tema"
              below={
                <OptionChips
                  options={THEMES}
                  isSelected={(v) => v === settings.theme}
                  onPress={(theme) => updateSettings({ theme })}
                />
              }
            />
            <SettingsRow
              label="Color"
              detail="Botones, pestañas y detalles de la app."
              below={
                <OptionChips<AccentChoice>
                  options={[
                    ...(Object.keys(accents) as AccentName[]).map((name) => ({
                      value: name as AccentChoice,
                      label: accents[name].label,
                      color: accents[name][mode].primary,
                    })),
                    // El último: un color elegido a mano en un recuadro.
                    {
                      value: 'custom',
                      label: 'Personalizado',
                      color: customAccentColors(settings.customAccent)[mode].primary,
                    },
                  ]}
                  isSelected={(v) => v === settings.accent}
                  onPress={(accent) =>
                    accent === 'custom' ? setPickingColor(true) : updateSettings({ accent })
                  }
                />
              }
            />
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title="Contadores">
        <SettingsRow
          first
          label="Botones rápidos"
          detail={`Las cantidades que se suman de un toque (hasta ${MAX_QUICK_AMOUNTS}). Mantén pulsado el primero para escribir otra.`}
          below={
            <OptionChips
              role="checkbox"
              options={QUICK_AMOUNT_OPTIONS.map((n) => ({ value: n, label: `+${n}` }))}
              isSelected={(n) => settings.quickAmounts.includes(n)}
              onPress={(n) =>
                updateSettings({ quickAmounts: toggleQuickAmount(settings.quickAmounts, n) })
              }
            />
          }
        />
        <SwitchRow
          label="Confirmar al restar"
          detail="Pregunta antes de guardar un −1."
          value={settings.confirmRemove}
          onChange={(confirmRemove) => updateSettings({ confirmRemove })}
        />
        <SwitchRow
          label="Vibración"
          detail="Una vibración suave al sumar o restar."
          value={settings.haptics}
          onChange={(haptics) => updateSettings({ haptics })}
        />
        <SettingsRow
          label="Gráfica de Estadísticas"
          detail={
            statsCounter
              ? `Empieza mostrando «${statsCounter.name}».`
              : 'Empieza mostrando el último contador que usaste.'
          }
          onPress={() => router.push('/configuracion/estadisticas')}
        />
      </SettingsGroup>

      <SettingsGroup title="Notificaciones">
        <SwitchRow
          first
          label="Recordatorio de la racha"
          detail="Un aviso a la hora elegida si ese día aún no has registrado nada."
          value={reminder.enabled}
          onChange={(value) => toggleReminder('enabled', value)}
        />
        <SwitchRow
          label="Recordatorio de contadores de racha"
          detail="Un aviso por cada contador en formato racha que ese día aún no hayas mantenido."
          value={reminder.counters}
          onChange={(value) => toggleReminder('counters', value)}
        />
        {reminder.enabled || reminder.counters ? (
          <SettingsRow
            label="Hora del aviso"
            onPress={Platform.OS === 'android' ? openAndroidTimePicker : undefined}
            right={
              Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={reminderTime}
                  mode="time"
                  display="compact"
                  locale="es-ES"
                  themeVariant={mode}
                  onValueChange={(_event, date) => setReminderTime(date)}
                />
              ) : (
                <Text style={[styles.value, { color: colors.primary }]}>
                  {pad(reminder.hour)}:{pad(reminder.minute)}
                </Text>
              )
            }
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="Privacidad">
        <SwitchRow
          first
          label="Ocultar mi racha"
          detail="Tus amigos no verán tu racha ni saldrás en su clasificación de rachas."
          value={profile.data?.hide_streak ?? false}
          onChange={(hide_streak) => setPrivacy({ hide_streak })}
          disabled={!profile.data}
        />
        <SwitchRow
          label="Ocultar mis números a mis amigos"
          detail="Seguirán viendo tus contadores, pero no cuánto llevas. En los contadores que compartís en un grupo sí se ve."
          value={profile.data?.hide_counter_totals ?? false}
          onChange={(hide_counter_totals) => setPrivacy({ hide_counter_totals })}
          disabled={!profile.data}
        />
        <SettingsRow
          label="Invitaciones a grupos"
          detail="Con código o enlace siempre puedes unirte a un grupo."
          below={
            <OptionChips
              options={[
                { value: 'friends' as const, label: 'De mis amigos' },
                { value: 'nobody' as const, label: 'Solo con código' },
              ]}
              isSelected={(v) => v === (profile.data?.group_invites ?? 'friends')}
              onPress={(group_invites) => setPrivacy({ group_invites })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Cuenta">
        <SettingsRow
          first
          label={exportData.isPending ? 'Exportando…' : 'Exportar mis datos'}
          detail="Todos tus registros en formato CSV (se abre en una hoja de cálculo)."
          onPress={exportData.isPending ? undefined : () => exportData.mutate()}
        />
        <SettingsRow
          label={logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          onPress={logout.isPending ? undefined : () => logout.mutate()}
        />
        <SettingsRow
          label={deleteAccount.isPending ? 'Eliminando…' : 'Eliminar cuenta'}
          detail="Borra tu cuenta y todos tus datos."
          danger
          onPress={deleteAccount.isPending ? undefined : confirmDelete}
        />
      </SettingsGroup>

      <SettingsGroup title="Información">
        <SettingsRow
          first
          label="Versión"
          right={
            <Text style={[styles.value, { color: colors.textMuted }]}>
              {Constants.expoConfig?.version ?? '—'}
            </Text>
          }
        />
        <SettingsRow
          label="Ver tutorial"
          detail="Repasa en un minuto cómo funciona la app."
          onPress={startTutorial}
        />
        <SettingsRow
          label="Privacidad y datos"
          detail="Qué guarda Cuéntalo y quién lo ve."
          onPress={() => router.push('/configuracion/privacidad')}
        />
      </SettingsGroup>
      {pickingColor ? (
        <ColorPickerDialog
          initial={settings.customAccent}
          onCancel={() => setPickingColor(false)}
          onDone={(hex) => {
            setPickingColor(false);
            updateSettings({ accent: 'custom', customAccent: hex });
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 40 },
  value: { fontSize: 16, fontFamily: fonts.title },
  muted: { fontSize: 13, fontFamily: fonts.detail, marginTop: 2 },
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
});
