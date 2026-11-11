import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { showUndoToast } from '@/components/UndoToast';
import { AgeBlock, useNow } from '@/features/estadisticas/components/AgeBlock';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { useCounterList } from '@/features/contadores/hooks';
import { birthStart, isValidBirthDate, totalsLived } from '@/features/estadisticas/age';
import {
  useBirthDate,
  useSetBirthDate,
  useSetStatsBlocks,
  useStatsBlocks,
} from '@/features/perfil/birthDate';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount, formatWithUnit } from '@/lib/format';
import { displayFont, fonts, proseFont, useThemeColors } from '@/lib/theme';

/**
 * «Resumen vital» (botón del libro en Estadísticas). La primera vez pide la fecha de nacimiento
 * (se guarda en tu cuenta, privada: profile_private). Después: la edad exacta en tiempo real,
 * los días, horas y minutos vividos y todos los contadores de mayor a menor.
 */
export default function SummaryScreen() {
  const birth = useBirthDate();
  const [editing, setEditing] = useState(false);
  if (birth.isPending) return <LoadingView />;
  if (birth.isError) return <ErrorView error={birth.error} onRetry={birth.refetch} />;
  const birthDate = birth.data ?? null;
  if (!birthDate || editing) {
    return <BirthDateForm initial={birthDate} onDone={() => setEditing(false)} />;
  }
  return <Summary birthDate={birthDate} onChangeDate={() => setEditing(true)} />;
}

const LONG_DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function BirthDateForm({ initial, onDone }: { initial: string | null; onDone: () => void }) {
  const colors = useThemeColors();
  const save = useSetBirthDate();
  const [date, setDate] = useState(initial ?? '2000-01-01');
  const valid = isValidBirthDate(date);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.formContent}
    >
      <Ionicons name="book" size={56} color={colors.primary} />
      <Text style={[styles.formTitle, { color: colors.text }]} accessibilityRole="header">
        ¿Cuándo naciste?
      </Text>
      <Text style={[styles.detail, { color: colors.textMuted }]}>
        Con tu fecha de nacimiento calculamos todo lo que llevas vivido. Se guarda en tu cuenta y
        solo la ves tú.
      </Text>
      <Text style={[styles.dateText, { color: colors.text }]}>
        {LONG_DATE.format(birthStart(date))}
      </Text>
      {/* Calendario de la app: año → mes → día (la primera vez empieza por el año). */}
      <BirthDatePicker value={date} onChange={setDate} initialView={initial ? 'day' : 'year'} />
      <AppButton
        title="Generar resumen vital"
        disabled={!valid}
        loading={save.isPending}
        onPress={() =>
          save.mutate(date, {
            onSuccess: onDone,
            onError: (error) => appAlert('Error', getErrorMessage(error)),
          })
        }
      />
    </ScrollView>
  );
}

function Summary({ birthDate, onChangeDate }: { birthDate: string; onChangeDate: () => void }) {
  const colors = useThemeColors();
  const counters = useCounterList();
  // Se actualiza cada segundo: lo vivido va en tiempo real.
  const now = useNow();

  const birth = birthStart(birthDate);
  const lived = totalsLived(birth, now);

  // Mis contadores (con lo mío), de mayor a menor. Los fusionados cuentan en su principal.
  const mine = (counters.data ?? [])
    .filter((c) => !c.linkedInto && (c.isActive || c.myEntryCount > 0))
    .sort((a, b) => b.myTotal - a.myTotal);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <AgeBlock birthDate={birthDate} action={<AddToStatsButton />} />

      <View style={styles.lines}>
        <Line label="Días vividos" value={formatAmount(lived.days)} />
        <Line label="Horas vividas" value={formatAmount(lived.hours)} />
        <Line label="Minutos vividos" value={formatAmount(lived.minutes)} />
      </View>
      {/* Sin título: un pequeño hueco separa lo vivido de los contadores. */}
      {mine.length === 0 ? (
        <Text style={[styles.detail, { color: colors.textMuted }]}>Aún no tienes contadores.</Text>
      ) : (
        <View style={styles.lines}>
          {mine.map((c) => (
            <Line
              key={c.id}
              label={c.name}
              value={formatWithUnit(c.myTotal, c.unit)}
              avatar={
                <CounterAvatar emoji={c.emoji} name={c.name} photoPath={c.photo_path} size={28} />
              }
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={onChangeDate}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.change}
      >
        <Text style={[styles.changeText, { color: colors.textMuted }]}>
          Naciste el {LONG_DATE.format(birth)} · Cambiar
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * El + del bloque «Tienes»: lo añade a Estadísticas (al final de sus bloques). Si ya está, un ✓
 * que lo quita.
 */
function AddToStatsButton() {
  const colors = useThemeColors();
  const blocks = useStatsBlocks();
  const setBlocks = useSetStatsBlocks();
  const added = blocks.includes('age');
  return (
    <Pressable
      onPress={() =>
        setBlocks.mutate(added ? blocks.filter((b) => b !== 'age') : [...blocks, 'age'], {
          onSuccess: () =>
            showUndoToast(added ? 'Quitado de Estadísticas' : 'Añadido a Estadísticas', () =>
              setBlocks.mutate(blocks),
            ),
        })
      }
      accessibilityRole="button"
      accessibilityLabel={added ? 'Quitar de Estadísticas' : 'Añadir a Estadísticas'}
      hitSlop={8}
      style={({ pressed }) => [
        styles.addButton,
        {
          backgroundColor: added ? colors.surface : colors.primary,
          borderColor: colors.primary,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons
        name={added ? 'checkmark' : 'add'}
        size={22}
        color={added ? colors.primary : colors.onPrimary}
      />
    </Pressable>
  );
}

/** Una línea del resumen: texto a la izquierda y número a la derecha. */
function Line({
  label,
  value,
  avatar,
}: {
  label: string;
  value: string;
  avatar?: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.line, { borderBottomColor: colors.border }]}>
      {avatar}
      <Text style={[styles.lineLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.lineValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: { padding: 24, gap: 18, alignItems: 'stretch' },
  formTitle: { ...displayFont(26) },
  detail: { ...proseFont(15, 21) },
  dateText: { fontSize: 17, fontFamily: fonts.title },
  content: { padding: 16, gap: 18 },
  lines: { gap: 0 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineLabel: { flex: 1, fontSize: 16, fontFamily: fonts.detail },
  lineValue: { fontSize: 16, fontFamily: fonts.title, fontVariant: ['tabular-nums'] },
  change: { alignSelf: 'center', paddingVertical: 8 },
  changeText: { fontSize: 14, fontFamily: fonts.detail },
});
