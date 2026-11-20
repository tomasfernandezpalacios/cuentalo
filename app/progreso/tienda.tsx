import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ItemPreview } from '@/features/progreso/components/ItemPreview';
import {
  Fitting,
  ItemGrid,
  ItemTile,
  WARDROBE_TABS,
  type TileFoot,
  type WardrobeTab,
} from '@/features/progreso/components/Wardrobe';
import { buyItem, buyShield, useProgress } from '@/features/progreso/demoStore';
import { levelInfo, MAX_SHIELDS, SHIELD_PRICE } from '@/features/progreso/model';
import { CATALOG, type ShopItem } from '@/features/progreso/shop';
import { fonts, proseFont, shape, useThemeColors } from '@/lib/theme';

type Tab = WardrobeTab | 'racha';

const TABS: { value: Tab; label: string }[] = [
  ...WARDROBE_TABS,
  { value: 'racha', label: 'Racha' },
];

/**
 * Orden de la tienda: primero lo que puedes comprar ya (de más barato a más caro), después lo que
 * pide más nivel y al final los regalos de nivel (que no se compran).
 */
function shopOrder(level: number) {
  const rank = (item: ShopItem) =>
    item.price === undefined ? 2 : level < (item.minLevel ?? 1) ? 1 : 0;
  return (a: ShopItem, b: ShopItem) =>
    rank(a) - rank(b) ||
    (a.price ?? 0) - (b.price ?? 0) ||
    (a.minLevel ?? a.giftLevel ?? 0) - (b.minLevel ?? b.giftLevel ?? 0);
}

/** Lo que dice cada casilla: precio, nivel que pide o nivel que lo regala. */
function footOf(item: ShopItem, level: number): TileFoot {
  if (item.price === undefined) return { kind: 'gift', text: `Nivel ${item.giftLevel ?? '?'}` };
  if (level < (item.minLevel ?? 1)) return { kind: 'locked', text: `Nivel ${item.minLevel}` };
  return { kind: 'price', price: item.price };
}

/**
 * Tienda (petición del usuario): solo lo que aún no tienes. Tocar algo te lo prueba en el
 * probador; después se compra con monedas (precio fijo, a veces con nivel mínimo) o se consigue
 * subiendo de nivel. También el protector de racha. Sin dinero real ni premios al azar.
 */
export default function ShopScreen() {
  const colors = useThemeColors();
  const progress = useProgress();
  const { level } = levelInfo(progress.xp);
  const [tab, setTab] = useState<Tab>('accesorio');
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const items = CATALOG.filter(
    (item) => item.kind === tab && !progress.owned.includes(item.id),
  ).sort(shopOrder(level));

  const onBuy = () => {
    if (!trying || !buyItem(trying.id)) return;
    const item = trying;
    setTrying(null);
    appAlert(
      '¡Es tuyo!',
      item.kind === 'accesorio'
        ? `${item.name} ya lo lleva puesto. Lo tienes en «Personalizar».`
        : item.kind === 'fondo'
          ? `${item.name} ya es tu fondo. Lo tienes en «Personalizar».`
          : `${item.name} ya es su animación. La tienes en «Personalizar».`,
      [{ text: 'Genial' }],
      { image: <ItemPreview item={item} size={110} /> },
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Fitting state={progress} trying={trying}>
        {trying ? (
          <TryingBar item={trying} level={level} coins={progress.coins} onBuy={onBuy} />
        ) : (
          <Text style={[styles.hint, { color: colors.textMuted }]}>Toca algo para probárselo.</Text>
        )}
      </Fitting>

      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={(value) => {
          setTab(value);
          setTrying(null);
        }}
      />

      {tab === 'racha' ? (
        <ShieldCard shields={progress.shields} coins={progress.coins} />
      ) : items.length === 0 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Ya lo tienes todo de este tipo. ¡Enhorabuena!
        </Text>
      ) : (
        <ItemGrid
          tab={tab}
          items={items}
          renderItem={(item) => {
            const foot = footOf(item, level);
            return (
              <ItemTile
                key={item.id}
                item={item}
                selected={trying?.id === item.id}
                dimmed={foot.kind !== 'price'}
                foot={foot}
                onPress={() => setTrying(trying?.id === item.id ? null : item)}
              />
            );
          }}
        />
      )}
    </ScrollView>
  );
}

/** Bajo el probador: lo que se prueba y cómo conseguirlo (comprar, nivel o regalo). */
function TryingBar({
  item,
  level,
  coins,
  onBuy,
}: {
  item: ShopItem;
  level: number;
  coins: number;
  onBuy: () => void;
}) {
  const colors = useThemeColors();
  let note: string | null = null;
  if (item.price === undefined) {
    note = `Te lo regalan al llegar al nivel ${item.giftLevel ?? '?'}`;
  } else if (level < (item.minLevel ?? 1)) {
    note = `Se desbloquea en el nivel ${item.minLevel}`;
  } else if (coins < item.price) {
    note = `Te faltan ${item.price - coins} monedas`;
  }
  return (
    <View style={styles.tryingBar}>
      <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
      {note ? (
        <Text style={[styles.note, styles.center, { color: colors.textMuted }]}>{note}</Text>
      ) : (
        <AppButton title={`Comprar · ${item.price} monedas`} onPress={onBuy} />
      )}
    </View>
  );
}

/** Protector de racha: si un día no registras nada, se gasta solo. Como mucho se guardan dos. */
function ShieldCard({ shields, coins }: { shields: number; coins: number }) {
  const colors = useThemeColors();
  const full = shields >= MAX_SHIELDS;
  return (
    <View style={[styles.shield, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.shieldHead}>
        <View style={[styles.shieldIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="shield" size={24} color="#F2C230" />
        </View>
        <View style={styles.shieldTexts}>
          <Text style={[styles.itemName, styles.left, { color: colors.text }]}>
            Protector de racha
          </Text>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {`Tienes ${shields} de ${MAX_SHIELDS}`}
          </Text>
        </View>
      </View>
      <Text style={[styles.hint, styles.left, { color: colors.textMuted }]}>
        Si un día no registras nada, se gasta solo y tu racha sigue viva. En el calendario de la
        racha ese día sale con un escudo amarillo.
      </Text>
      {full ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>Ya tienes el máximo.</Text>
      ) : (
        <AppButton
          title={`Comprar · ${SHIELD_PRICE} monedas`}
          variant="secondary"
          disabled={coins < SHIELD_PRICE}
          onPress={() => buyShield()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  hint: { ...proseFont(15, 21), textAlign: 'center' },
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  tryingBar: { gap: 10, alignItems: 'stretch' },
  itemName: { fontFamily: fonts.title, fontSize: 16, textAlign: 'center' },
  note: { fontFamily: fonts.detail, fontSize: 12 },
  shield: {
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  shieldHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTexts: { flex: 1, gap: 2 },
});
