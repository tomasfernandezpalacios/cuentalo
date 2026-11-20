import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GestureMascot } from '@/features/mascota/GestureMascot';
import type { Move } from '@/features/mascota/moves';
import { withAlpha } from '@/lib/color';
import { fonts, shape, useThemeColors } from '@/lib/theme';

import { Accessories } from '../Accessories';
import { useProgress, wornAccessories } from '../demoStore';
import { itemById, type AccessoryId, type BackgroundId } from '../shop';
import { GROUND, Scene } from './Scene';
import { Tappable } from '@/components/Tappable';

/** Alto del escenario respecto a su ancho (el de los fondos, 100 × 60). */
export const STAGE_RATIO = 0.6;

/** Distancia del centro de la bola a sus pies, en radios (piernas estiradas). */
const FEET = 2.65;
/** Hueco que deja `GestureMascot` por encima del centro de la bola, en radios. */
const ABOVE_CENTER = 1.3;

/**
 * La mascota en su fondo haciendo una animación. Sola no sabe nada del progreso: sirve para la
 * pestaña y para el probador de la tienda. `playKey` reinicia la animación al cambiar.
 */
export function MascotScene({
  width,
  background,
  gesture,
  accessories,
  playKey,
}: {
  width: number;
  background: BackgroundId;
  gesture: Move;
  accessories: AccessoryId[];
  playKey?: string | number;
}) {
  const height = width * STAGE_RATIO;
  const radius = height * 0.15;
  const ground = height * GROUND;
  return (
    <View style={{ width, height }}>
      <Scene id={background} width={width} height={height} />
      <View
        style={[
          styles.mascot,
          { top: ground - (FEET + ABOVE_CENTER) * radius, width, alignItems: 'center' },
        ]}
      >
        <GestureMascot key={`${gesture}-${playKey ?? ''}`} name={gesture} radius={radius}>
          <Accessories ids={accessories} />
        </GestureMascot>
      </View>
    </View>
  );
}

/**
 * Lo primero de «Progreso»: tu mascota en su fondo, con lo que lleva puesto, haciendo la animación
 * que elegiste cada vez que entras. «Personalizar» lleva a la tienda.
 */
export function MascotStage() {
  const colors = useThemeColors();
  const progress = useProgress();
  const [width, setWidth] = useState(0);
  // Cada vez que se entra en la pestaña, la animación empieza otra vez.
  const [visits, setVisits] = useState(0);
  useFocusEffect(useCallback(() => setVisits((v) => v + 1), []));

  const animation = itemById(progress.animation);
  const gesture: Move = animation?.kind === 'animacion' ? animation.move : 'wave';

  return (
    <View
      style={[styles.card, { borderColor: colors.border }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <MascotScene
          width={width}
          background={progress.background}
          gesture={gesture}
          accessories={wornAccessories(progress.equipped)}
          playKey={visits}
        />
      ) : (
        <View style={{ aspectRatio: 1 / STAGE_RATIO }} />
      )}
      <Tappable
        onPress={() => router.push('/progreso/personalizar')}
        accessibilityRole="button"
        accessibilityLabel="Personalizar tu mascota"
        hitSlop={8}
        style={({ pressed }) => [
          styles.customize,
          { backgroundColor: withAlpha(colors.background, 0.75), opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="color-palette-outline" size={16} color={colors.text} />
        <Text style={[styles.customizeText, { color: colors.text }]}>Personalizar</Text>
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  mascot: { position: 'absolute', left: 0 },
  customize: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: shape.chip,
  },
  customizeText: { fontFamily: fonts.title, fontSize: 13 },
});
