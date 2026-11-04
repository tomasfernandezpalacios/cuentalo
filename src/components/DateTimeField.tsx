import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

type Props = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
};

/** Selector de fecha y hora. No permite fechas futuras. */
export function DateTimeField({ label, value, onChange }: Props) {
  const colors = useThemeColors();
  const now = new Date();

  // En Android el selector es un diálogo nativo: primero la fecha y después la hora.
  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      maximumDate: now,
      onValueChange: (_event, date) => {
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_timeEvent, dateTime) => onChange(dateTime > now ? now : dateTime),
        });
      },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          maximumDate={now}
          locale="es-ES"
          onValueChange={(_event, date) => onChange(date)}
          style={styles.iosPicker}
        />
      ) : (
        <Pressable
          onPress={openAndroidPicker}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatDateTime(value)}. Cambiar`}
          style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.detail }}>
            {formatDateTime(value)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  iosPicker: { alignSelf: 'flex-start' },
});
