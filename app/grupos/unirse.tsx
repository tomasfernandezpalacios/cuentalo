import { StyleSheet, Text } from 'react-native';

import { FormScreen } from '@/components/FormScreen';
import { JoinByCode } from '@/features/social/components/GroupsPanel';
import { proseFont, useThemeColors } from '@/lib/theme';

/** Unirse a un grupo con su código (desde la llave de la cabecera de «Amigos y grupos»). */
export default function JoinGroupScreen() {
  const colors = useThemeColors();
  return (
    <FormScreen>
      <Text style={[styles.explain, { color: colors.textMuted }]}>
        Escribe el código que te han pasado (ocho letras y números, como ABCD-EFGH). También puedes
        abrir directamente el enlace que te hayan enviado.
      </Text>
      <JoinByCode />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  explain: { ...proseFont(15, 21) },
});
