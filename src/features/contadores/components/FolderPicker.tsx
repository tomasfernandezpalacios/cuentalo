import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import type { Folder } from '../folders';

type Props = {
  visible: boolean;
  folders: Folder[];
  /** Contadores que se van a añadir (para marcar las carpetas que ya los tienen todos). */
  counterIds: string[];
  onPick: (folder: Folder) => void;
  onNewFolder: () => void;
  onClose: () => void;
};

/** Elegir a qué carpeta añadir los contadores seleccionados, o crear una nueva. */
export function FolderPicker({
  visible,
  folders,
  counterIds,
  onPick,
  onNewFolder,
  onClose,
}: Props) {
  const colors = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable onPress={() => {}} style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Añadir a una carpeta
          </Text>
          <ScrollView style={styles.list}>
            {folders.map((folder) => {
              const already = counterIds.every((id) => folder.counterIds.includes(id));
              return (
                <Pressable
                  key={folder.id}
                  onPress={() => onPick(folder)}
                  disabled={already}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: already }}
                  style={[styles.row, { borderBottomColor: colors.border }]}
                >
                  <Ionicons name="folder-outline" size={22} color={colors.primary} />
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {folder.name}
                  </Text>
                  {already ? (
                    <Text style={[styles.detail, { color: colors.textMuted }]}>Ya están</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={onNewFolder}
              accessibilityRole="button"
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={[styles.name, { color: colors.primary }]}>Nueva carpeta</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: { borderRadius: 20, padding: 18, gap: 8, maxHeight: '70%' },
  title: { fontSize: 19, fontFamily: fonts.title },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 16, fontFamily: fonts.title },
  detail: { fontSize: 13, fontFamily: fonts.detail },
});
