import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Move } from '@/features/mascota/moves';
import { fonts, shape, useThemeColors } from '@/lib/theme';

import { wornAccessories, type ProgressState } from '../demoStore';
import { itemById, SLOT_LABEL, type BackgroundId, type ShopItem, type Slot } from '../shop';
import { CoinIcon } from './Bits';
import { ItemPreview } from './ItemPreview';
import { MascotScene } from './MascotStage';

// Piezas comunes de «Personalizar» (lo que tienes) y la tienda (lo que no): el probador, las
// pestañas por tipo y las casillas de cada cosa.

export type WardrobeTab = 'accesorio' | 'fondo' | 'animacion';

export const WARDROBE_TABS: { value: WardrobeTab; label: string }[] = [
  { value: 'accesorio', label: 'Disfraces' },
  { value: 'fondo', label: 'Fondos' },
  { value: 'animacion', label: 'Animación' },
];

const SLOTS: Slot[] = ['cabeza', 'ojos', 'cuello'];

/** Cómo se ve la mascota con lo puesto y, encima, lo que se está probando. */
export function lookWith(state: ProgressState, trying: ShopItem | null) {
  const animation = itemById(state.animation);
  let move: Move = animation?.kind === 'animacion' ? animation.move : 'wave';
  let background: BackgroundId = state.background;
  let equipped = state.equipped;
  if (trying?.kind === 'accesorio') equipped = { ...equipped, [trying.slot]: trying.id };
  if (trying?.kind === 'fondo') background = trying.id;
  if (trying?.kind === 'animacion') move = trying.move;
  return { move, background, accessories: wornAccessories(equipped) };
}

/** Probador: la mascota en su fondo (con lo probado encima) y debajo lo que se quiera. */
export function Fitting({
  state,
  trying,
  children,
}: {
  state: ProgressState;
  trying: ShopItem | null;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const look = lookWith(state, trying);
  return (
    <View style={[styles.fitting, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <MascotScene
            width={width}
            background={look.background}
            gesture={look.move}
            accessories={look.accessories}
            playKey={`${trying?.id ?? ''}-${state.animation}`}
          />
        ) : null}
      </View>
      <View style={styles.fittingFoot}>{children}</View>
    </View>
  );
}

/**
 * Casillas de un tipo; los disfraces van agrupados por sitio (cabeza, ojos, cuello). Los grupos
 * vacíos no salen.
 */
export function ItemGrid({
  tab,
  items,
  renderItem,
}: {
  tab: WardrobeTab;
  items: ShopItem[];
  renderItem: (item: ShopItem) => ReactNode;
}) {
  const colors = useThemeColors();
  if (tab !== 'accesorio') {
    return <View style={styles.grid}>{items.map(renderItem)}</View>;
  }
  return (
    <>
      {SLOTS.map((slot) => {
        const inSlot = items.filter((item) => item.kind === 'accesorio' && item.slot === slot);
        if (inSlot.length === 0) return null;
        return (
          <View key={slot} style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{SLOT_LABEL[slot]}</Text>
            <View style={styles.grid}>{inSlot.map(renderItem)}</View>
          </View>
        );
      })}
    </>
  );
}

/** Lo que pone debajo de cada casilla. */
export type TileFoot =
  | { kind: 'text'; text: string; highlight?: boolean }
  | { kind: 'price'; price: number }
  | { kind: 'locked'; text: string }
  | { kind: 'gift'; text: string };

export function ItemTile({
  item,
  selected,
  dimmed,
  foot,
  onPress,
}: {
  item: ShopItem;
  selected: boolean;
  dimmed?: boolean;
  foot: TileFoot;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={{ opacity: dimmed ? 0.45 : 1 }}>
        <ItemPreview item={item} />
      </View>
      <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.tileFoot}>
        {foot.kind === 'price' ? (
          <>
            <CoinIcon size={13} />
            <Text style={[styles.note, { color: colors.text }]}>{foot.price}</Text>
          </>
        ) : foot.kind === 'locked' || foot.kind === 'gift' ? (
          <>
            <Ionicons
              name={foot.kind === 'gift' ? 'gift-outline' : 'lock-closed-outline'}
              size={12}
              color={colors.textMuted}
            />
            <Text style={[styles.note, { color: colors.textMuted }]}>{foot.text}</Text>
          </>
        ) : (
          <Text
            style={[styles.note, { color: foot.highlight ? colors.primary : colors.textMuted }]}
          >
            {foot.text}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fitting: {
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fittingFoot: { padding: 14, gap: 10 },
  group: { gap: 8 },
  groupTitle: { fontFamily: fonts.title, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '32%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: shape.card - 8,
    borderWidth: 1,
  },
  tileName: { fontFamily: fonts.title, fontSize: 12 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  note: { fontFamily: fonts.detail, fontSize: 12 },
});
