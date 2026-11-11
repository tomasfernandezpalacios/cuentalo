import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chipColors, fonts, useThemeColors } from '@/lib/theme';

import type { Folder } from '../folders';

type Props = {
  folders: Folder[];
  /** null = "Todos". */
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
  onLongPressFolder: (folder: Folder) => void;
  onNewFolder: () => void;
  /**
   * Modo selección (al mantener pulsado un contador): la barra sirve para seleccionar en masa.
   * «Todos» y cada carpeta añaden sus contadores a la selección (o los quitan si ya estaban
   * todos); no hay «Nueva carpeta». `allIds`: los contadores de la lista.
   */
  selection?: { selectedIds: string[]; allIds: string[]; onToggle: (ids: string[]) => void };
};

/**
 * Barra fina bajo la cabecera: «Todos», las carpetas y «Nueva carpeta». Se desliza de lado. En el
 * modo selección, «Todos» y las carpetas seleccionan sus contadores.
 */
export function FolderBar({
  folders,
  selectedId,
  onSelect,
  onLongPressFolder,
  onNewFolder,
  selection,
}: Props) {
  const colors = useThemeColors();

  if (selection) {
    const isAllSelected = (ids: string[]) =>
      ids.length > 0 && ids.every((id) => selection.selectedIds.includes(id));
    const groupChip = (key: string, label: string, ids: string[]) => {
      const on = isAllSelected(ids);
      return chip(key, label, on, () => selection.onToggle(ids), undefined, {
        role: 'checkbox',
        hint: on ? 'Quita sus contadores de la selección' : 'Selecciona sus contadores',
        disabled: ids.length === 0,
      });
    };
    return (
      <View
        style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {groupChip('all', 'Todos', selection.allIds)}
          {folders.map((folder) =>
            groupChip(
              folder.id,
              folder.name,
              folder.counterIds.filter((id) => selection.allIds.includes(id)),
            ),
          )}
        </ScrollView>
      </View>
    );
  }

  function chip(
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    onLongPress?: () => void,
    options: { role?: 'tab' | 'checkbox'; hint?: string; disabled?: boolean } = {},
  ) {
    const role = options.role ?? 'tab';
    return (
      <Pressable
        key={key}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={options.disabled}
        accessibilityRole={role}
        accessibilityState={role === 'tab' ? { selected } : { checked: selected }}
        accessibilityHint={
          options.hint ??
          (onLongPress ? 'Mantén pulsado para editar o borrar la carpeta' : undefined)
        }
        style={[
          styles.chip,
          {
            backgroundColor: chipColors(colors, selected).backgroundColor,
            borderColor: chipColors(colors, selected).borderColor,
            opacity: options.disabled ? 0.4 : 1,
          },
        ]}
      >
        <Text
          style={[styles.label, { color: chipColors(colors, selected).color }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        accessibilityRole="tablist"
      >
        {chip('all', 'Todos', selectedId === null, () => onSelect(null))}
        {folders.map((folder) =>
          chip(
            folder.id,
            folder.name,
            folder.id === selectedId,
            () => onSelect(folder.id),
            () => onLongPressFolder(folder),
          ),
        )}
        <Pressable
          onPress={onNewFolder}
          accessibilityRole="button"
          accessibilityLabel="Nueva carpeta"
          style={[styles.chip, styles.newChip, { borderColor: colors.primary }]}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={[styles.label, { color: colors.primary }]} maxFontSizeMultiplier={1.3}>
            Nueva carpeta
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
  },
  newChip: { flexDirection: 'row', gap: 4, borderStyle: 'dashed' },
  label: { fontSize: 14, fontFamily: fonts.title },
});
