import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

/** Tarjeta que agrupa las filas de una sección de Configuración. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textMuted }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

type RowProps = {
  label: string;
  detail?: string;
  /** Lo que va a la derecha (un interruptor, un valor…). Si hay onPress y no hay nada, una flecha. */
  right?: ReactNode;
  /** Contenido debajo del texto (p. ej. botones de opciones). */
  below?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
};

/** Fila de Configuración: texto, detalle opcional y un control a la derecha o debajo. */
export function SettingsRow({ label, detail, right, below, onPress, danger, first }: RowProps) {
  const colors = useThemeColors();
  const content = (
    <>
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: danger ? colors.danger : colors.text }]}>
            {label}
          </Text>
          {detail ? (
            <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>
          ) : null}
        </View>
        {right ??
          (onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null)}
      </View>
      {below}
    </>
  );
  const rowStyle = [
    styles.row,
    !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  ];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

type SwitchRowProps = {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  first?: boolean;
  disabled?: boolean;
};

/** Fila con interruptor. */
export function SwitchRow({ label, detail, value, onChange, first, disabled }: SwitchRowProps) {
  const colors = useThemeColors();
  return (
    <SettingsRow
      first={first}
      label={label}
      detail={detail}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
}

type Option<T> = { value: T; label: string; color?: string };

type ChipsProps<T> = {
  options: Option<T>[];
  isSelected: (value: T) => boolean;
  onPress: (value: T) => void;
  /** Para lectores de pantalla: 'radio' (uno) o 'checkbox' (varios). */
  role?: 'radio' | 'checkbox';
};

/** Botones de opciones en fila (se parten en varias líneas si no caben). */
export function OptionChips<T extends string | number>({
  options,
  isSelected,
  onPress,
  role = 'radio',
}: ChipsProps<T>) {
  const colors = useThemeColors();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onPress(option.value)}
            accessibilityRole={role}
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            hitSlop={4}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.background,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            {option.color ? (
              <View style={[styles.swatch, { backgroundColor: option.color }]} />
            ) : null}
            <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: 8 },
  groupTitle: { fontSize: 14, fontFamily: fonts.title, marginLeft: 4 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 52, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 16, fontFamily: fonts.title },
  detail: { fontSize: 13, fontFamily: fonts.detail, marginTop: 2, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  chipText: { fontSize: 14, fontFamily: fonts.title },
});
