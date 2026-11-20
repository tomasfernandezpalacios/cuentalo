import { ScrollView, StyleSheet } from 'react-native';

import { MascotStage } from '@/features/progreso/components/MascotStage';
import { Missions } from '@/features/progreso/components/Missions';
import { useThemeColors } from '@/lib/theme';
import { useTabBarSpace } from '@/lib/useTabBarSpace';

/**
 * «Progreso» (gamificación; análisis y decisiones en `docs/gamificacion/2026-11-20-analisis.md`):
 * premia la constancia, nunca la cantidad. Arriba tu mascota en su fondo, haciendo la animación
 * que elegiste; debajo las misiones. El nivel (con su barrita, abre el camino de rangos) y las
 * monedas van en la cabecera. De momento con datos de ejemplo en memoria (`demoStore.ts`).
 */
export default function ProgressScreen() {
  const colors = useThemeColors();
  const bottom = useTabBarSpace();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
    >
      <MascotStage />
      <Missions />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
});
