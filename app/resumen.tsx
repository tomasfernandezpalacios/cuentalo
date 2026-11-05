import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { updateSettings, useSettings } from '@/features/configuracion/settings';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { useCounterList } from '@/features/contadores/hooks';
import {
  ageBreakdown,
  birthStart,
  isValidBirthDate,
  totalsLived,
} from '@/features/estadisticas/age';
import { formatAmount, formatWithUnit } from '@/lib/format';
import { fonts, useColorMode, useThemeColors } from '@/lib/theme';

/**
 * Resumen («Tu vida en Cuéntalo», botón del libro en Estadísticas). La primera vez pide la fecha
 * de nacimiento (se guarda solo en el móvil). Después: la edad exacta en tiempo real, los días,
 * horas y minutos vividos y todos los contadores de mayor a menor.
 */
export default function SummaryScreen() {
  const { birthDate } = useSettings();
  const [editing, setEditing] = useState(false);
  if (!birthDate || editing) {
    return <BirthDateForm initial={birthDate} onDone={() => setEditing(false)} />;
  }
  return <Summary birthDate={birthDate} onChangeDate={() => setEditing(true)} />;
}

function toKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const LONG_DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function BirthDateForm({ initial, onDone }: { initial: string | null; onDone: () => void }) {
  const colors = useThemeColors();
  const mode = useColorMode();
  const [date, setDate] = useState(() => (initial ? birthStart(initial) : new Date(2000, 0, 1)));
  const today = new Date();
  const valid = isValidBirthDate(toKey(date), today);

  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      maximumDate: today,
      minimumDate: new Date(today.getFullYear() - 120, 0, 1),
      onValueChange: (_event, picked) => setDate(picked),
    });
  }

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
        Con tu fecha de nacimiento calculamos todo lo que llevas vivido. Se guarda solo en este
        móvil.
      </Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          maximumDate={today}
          locale="es-ES"
          themeVariant={mode}
          onValueChange={(_event, picked) => setDate(picked)}
        />
      ) : (
        <Pressable
          onPress={openAndroidPicker}
          accessibilityRole="button"
          accessibilityLabel={`Fecha de nacimiento: ${LONG_DATE.format(date)}. Cambiar`}
          style={[
            styles.dateField,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={[styles.dateText, { color: colors.text }]}>{LONG_DATE.format(date)}</Text>
        </Pressable>
      )}
      <AppButton
        title="Generar resumen"
        disabled={!valid}
        onPress={() => {
          updateSettings({ birthDate: toKey(date) });
          onDone();
        }}
      />
    </ScrollView>
  );
}

function Summary({ birthDate, onChangeDate }: { birthDate: string; onChangeDate: () => void }) {
  const colors = useThemeColors();
  const counters = useCounterList();
  // Se actualiza cada segundo: la edad va en tiempo real.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const birth = birthStart(birthDate);
  const age = ageBreakdown(birth, now);
  const lived = totalsLived(birth, now);
  const parts: { value: number; label: [string, string] }[] = [
    { value: age.years, label: ['año', 'años'] },
    { value: age.months, label: ['mes', 'meses'] },
    { value: age.weeks, label: ['semana', 'semanas'] },
    { value: age.days, label: ['día', 'días'] },
    { value: age.hours, label: ['hora', 'horas'] },
    { value: age.minutes, label: ['minuto', 'minutos'] },
    { value: age.seconds, label: ['segundo', 'segundos'] },
  ];

  // Mis contadores (con lo mío), de mayor a menor. Los fusionados cuentan en su principal.
  const mine = (counters.data ?? [])
    .filter((c) => !c.linkedInto && (c.isActive || c.myEntryCount > 0))
    .sort((a, b) => b.myTotal - a.myTotal);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View
        style={[styles.ageBlock, { backgroundColor: colors.primarySoft }]}
        accessible
        accessibilityLabel={`Tienes ${parts.map((p) => `${p.value} ${p.label[p.value === 1 ? 0 : 1]}`).join(', ')}`}
      >
        <Text style={[styles.ageTitle, { color: colors.text }]}>Tienes</Text>
        <View style={styles.grid}>
          {parts.map((p) => (
            <View key={p.label[1]} style={[styles.tile, { backgroundColor: colors.surface }]}>
              <Text style={[styles.tileValue, { color: colors.primary }]} allowFontScaling={false}>
                {p.value}
              </Text>
              <Text style={[styles.tileLabel, { color: colors.textMuted }]}>
                {p.label[p.value === 1 ? 0 : 1]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.lines}>
        <Line label="Días vividos" value={formatAmount(lived.days)} />
        <Line label="Horas vividas" value={formatAmount(lived.hours)} />
        <Line label="Minutos vividos" value={formatAmount(lived.minutes)} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        Tus contadores
      </Text>
      {mine.length === 0 ? (
        <Text style={[styles.detail, { color: colors.textMuted }]}>Aún no tienes contadores.</Text>
      ) : (
        <View style={styles.lines}>
          {mine.map((c) => (
            <Line
              key={c.id}
              label={c.name}
              value={formatWithUnit(c.myTotal, c.unit)}
              avatar={<CounterAvatar emoji={c.emoji} name={c.name} size={28} />}
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
  formContent: { padding: 24, gap: 18, alignItems: 'stretch' },
  formTitle: { fontSize: 26, fontFamily: fonts.title },
  detail: { fontSize: 15, fontFamily: fonts.detail, lineHeight: 21 },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  dateText: { fontSize: 17, fontFamily: fonts.title },
  content: { padding: 16, gap: 18 },
  ageBlock: { borderRadius: 20, padding: 16, gap: 12 },
  ageTitle: { fontSize: 22, fontFamily: fonts.title },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tileValue: { fontSize: 28, fontFamily: fonts.title, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 13, fontFamily: fonts.detail },
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
  sectionTitle: { fontSize: 18, fontFamily: fonts.title },
  change: { alignSelf: 'center', paddingVertical: 8 },
  changeText: { fontSize: 14, fontFamily: fonts.detail },
});
