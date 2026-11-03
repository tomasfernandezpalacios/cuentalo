import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { fonts, useThemeColors } from '@/lib/theme';

/** Botón ⓘ que abre una explicación de qué es un contador común. */
export function CommonCounterInfo() {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="¿Qué es un contador común?"
        hitSlop={10}
      >
        <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              👥 Contador común
            </Text>
            <Text style={[styles.text, { color: colors.text }]}>
              Sirve para cosas que hacéis juntos. Cuando cualquiera del grupo pulsa +1, se suma 1 a
              todas las personas que elijas, y el −1 les resta 1 a todas.
            </Text>
            <Text style={[styles.text, { color: colors.textMuted }]}>
              Ejemplo: «✈️ Viajes». Marcas a quienes vais juntos y, al volver de cada viaje, con un
              solo +1 se apunta a todos. A cada uno le cuenta en sus estadísticas.
            </Text>
            <Text style={[styles.text, { color: colors.textMuted }]}>
              Si no lo marcas, cada miembro suma solo lo suyo (por ejemplo, «🍺 Cervezas»).
            </Text>
            <AppButton title="Entendido" onPress={() => setOpen(false)} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: { borderRadius: 20, padding: 20, gap: 12 },
  title: { fontSize: 20, fontFamily: fonts.title },
  text: { fontSize: 15, fontFamily: fonts.detail, lineHeight: 21 },
});
