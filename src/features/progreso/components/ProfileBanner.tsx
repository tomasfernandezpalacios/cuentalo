import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GestureMascot } from '@/features/mascota/GestureMascot';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { shape, useThemeColors } from '@/lib/theme';

import { Accessories } from '../Accessories';
import { demoLookFor } from '../demoLooks';
import { GROUND, Scene } from './Scene';
import { STAGE_RATIO } from './MascotStage';

/** Alto de la cabecera respecto a su ancho (más alargada que el escenario de «Progreso»). */
const BANNER_RATIO = 0.46;
/** Distancia del centro de la bola a sus pies y hueco por encima, en radios (como el escenario). */
const FEET = 2.65;
const ABOVE_CENTER = 1.3;

/**
 * Cabecera del perfil de otra persona (petición del usuario): el fondo de su mascota a lo ancho,
 * su foto de perfil a la izquierda y su mascota a la derecha, igual que en «Progreso». El fondo se
 * recorta por arriba (no se estira) para que no se deforme. PRUEBA: la mascota sale de su id
 * (`demoLooks.ts`) hasta que el progreso se guarde en Supabase.
 */
export function ProfileBanner({
  userId,
  name,
  emoji,
  photoPath,
}: {
  userId: string;
  name: string;
  emoji: string | null;
  photoPath: string | null;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const [visits, setVisits] = useState(0);
  useFocusEffect(useCallback(() => setVisits((v) => v + 1), []));
  const look = demoLookFor(userId);

  const height = width * BANNER_RATIO;
  const sceneHeight = width * STAGE_RATIO;
  const sceneTop = height - sceneHeight;
  const ground = sceneTop + sceneHeight * GROUND;
  const radius = height * 0.17;
  const avatar = Math.round(height * 0.62);

  return (
    <View
      style={[styles.banner, { height: height || undefined, borderColor: colors.border }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <>
          <View style={[styles.abs, { top: sceneTop }]}>
            <Scene id={look.background} width={width} height={sceneHeight} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.abs,
              {
                left: width * 0.72 - 2.5 * radius,
                top: ground - (FEET + ABOVE_CENTER) * radius,
              },
            ]}
          >
            <GestureMascot key={`${look.move}-${visits}`} name={look.move} radius={radius}>
              <Accessories ids={look.accessories} />
            </GestureMascot>
          </View>
          <View
            style={[
              styles.photo,
              {
                left: 20,
                top: (height - avatar) / 2 - 6,
                width: avatar + 8,
                height: avatar + 8,
                borderRadius: (avatar + 8) / 2,
                backgroundColor: colors.background,
              },
            ]}
          >
            <PersonAvatar name={name} emoji={emoji} photoPath={photoPath} size={avatar} />
          </View>
        </>
      ) : (
        <View style={{ aspectRatio: 1 / BANNER_RATIO }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  abs: { position: 'absolute', left: 0 },
  photo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
