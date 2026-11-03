import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fonts, useThemeColors } from '@/lib/theme';

import {
  DEFAULT_FILTERS,
  type ActivityWindow,
  type CounterFilters,
  type CounterKind,
} from '../filters';
import type { Folder } from '../folders';

const KINDS: { value: CounterKind; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'individual', label: 'Individuales' },
  { value: 'group', label: 'De grupo' },
];

const ACTIVITY: { value: ActivityWindow; label: string }[] = [
  { value: 'any', label: 'Siempre' },
  { value: 'day', label: 'Último día' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mes' },
  { value: 'year', label: 'Último año' },
];

type Props = {
  visible: boolean;
  filters: CounterFilters;
  folders: Folder[];
  onChange: (filters: CounterFilters) => void;
  onClose: () => void;
};

/** Rectángulo que se despliega bajo la cabecera con los filtros de la lista. */
export function FilterMenu({ visible, filters, folders, onChange, onClose }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  function chips<T extends string | null>(
    options: { value: T; label: string }[],
    value: T,
    select: (value: T) => void,
  ) {
    return (
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.label}
              onPress={() => select(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar filtros">
        <Pressable
          // Evita que tocar dentro del rectángulo lo cierre.
          onPress={() => {}}
          style={[
            styles.card,
            {
              top: insets.top + 52,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              Filtrar contadores
            </Text>

            <Text style={[styles.label, { color: colors.textMuted }]}>Carpeta</Text>
            {chips(
              [
                { value: null, label: 'Todas' },
                ...folders.map((f) => ({ value: f.id, label: f.name })),
              ],
              filters.folderId,
              (folderId) => onChange({ ...filters, folderId }),
            )}

            <Text style={[styles.label, { color: colors.textMuted }]}>Tipo</Text>
            <SegmentedControl
              options={KINDS}
              value={filters.kind}
              onChange={(kind) => onChange({ ...filters, kind })}
            />

            <Text style={[styles.label, { color: colors.textMuted }]}>Con registros en</Text>
            {chips(ACTIVITY, filters.activity, (activity) => onChange({ ...filters, activity }))}

            <View style={styles.actions}>
              <AppButton
                small
                variant="ghost"
                title="Quitar filtros"
                onPress={() => onChange(DEFAULT_FILTERS)}
                style={styles.flex}
              />
              <AppButton small title="Listo" onPress={onClose} style={styles.flex} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  card: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxHeight: '75%',
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 17, fontFamily: fonts.title },
  label: { fontSize: 14, fontFamily: fonts.detail, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: fonts.title },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  flex: { flex: 1 },
});
