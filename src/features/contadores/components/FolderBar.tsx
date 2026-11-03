import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import type { Folder } from '../folders';

type Props = {
  folders: Folder[];
  /** null = "Todos". */
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
  onLongPressFolder: (folder: Folder) => void;
  onNewFolder: () => void;
};

/** Barra fina bajo la cabecera: «Todos», las carpetas y «Nueva carpeta». Se desliza de lado. */
export function FolderBar({
  folders,
  selectedId,
  onSelect,
  onLongPressFolder,
  onNewFolder,
}: Props) {
  const colors = useThemeColors();

  function chip(
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    onLongPress?: () => void,
  ) {
    return (
      <Pressable
        key={key}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityHint={
          onLongPress ? 'Mantén pulsado para editar o borrar la carpeta' : undefined
        }
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.primary : colors.background,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[styles.label, { color: selected ? colors.onPrimary : colors.text }]}
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
