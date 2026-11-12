import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { proseFont, titleFont, useThemeColors } from '@/lib/theme';

type InfoProps = {
  /** Lo que lee el lector de pantalla en el botón. */
  label: string;
  title: string;
  /** Párrafos: el primero en el color del texto, los demás más suaves. */
  paragraphs: string[];
};

/**
 * Botón ⓘ (del color de la app) que abre una ventana con una explicación. Se usa a la derecha de
 * las opciones del formulario de contador («Contador común», «Formato racha»).
 */
export function InfoButton({ label, title, paragraphs }: InfoProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={10}
      >
        <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            {paragraphs.map((text, index) => (
              <Text
                key={index}
                style={[styles.text, { color: index === 0 ? colors.text : colors.textMuted }]}
              >
                {text}
              </Text>
            ))}
            <AppButton title="Entendido" onPress={() => setOpen(false)} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** ⓘ de qué es un contador común. */
export function CommonCounterInfo() {
  return (
    <InfoButton
      label="¿Qué es un contador común?"
      title="👥 Contador común"
      paragraphs={[
        'Sirve para cosas que hacéis juntos. Su administrador (quien lo crea) suma o resta a la ' +
          'vez a todas las personas que elija; los demás le piden los cambios con una solicitud.',
        'Ejemplo: «✈️ Viajes». Marcas a quienes vais juntos y, al volver de cada viaje, con un ' +
          'solo toque se apunta a todos. A cada uno le cuenta en sus estadísticas.',
        'Si no lo marcas, cada miembro suma solo lo suyo (por ejemplo, «🍺 Cervezas»).',
      ]}
    />
  );
}

/** ⓘ de qué es el formato racha. */
export function StreakFormatInfo({ inGroup }: { inGroup: boolean }) {
  return (
    <InfoButton
      label="¿Qué es el formato racha?"
      title="🔥 Formato racha"
      paragraphs={[
        'Para cosas como «días sin fumar»: el contador suma como siempre y, además, lleva una ' +
          'racha de días seguidos en los que sumes +1 o más.',
        'Si un día no llegas, la racha vuelve a 0, pero el contador no. Se guarda tu récord.' +
          (inGroup ? ' En un grupo, cada uno tiene su propia racha.' : ''),
      ]}
    />
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
  title: { ...titleFont(20) },
  text: { ...proseFont(15, 21) },
});
