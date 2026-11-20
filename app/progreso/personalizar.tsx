import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import {
  Fitting,
  ItemGrid,
  ItemTile,
  WARDROBE_TABS,
  type WardrobeTab,
} from '@/features/progreso/components/Wardrobe';
import { isInUse, selectItem, useProgress } from '@/features/progreso/demoStore';
import { CATALOG, KIND_LABEL } from '@/features/progreso/shop';
import { fonts, proseFont, shape, useThemeColors } from '@/lib/theme';

/**
 * Personalizar tu mascota (petición del usuario): solo lo que ya tienes. Tocar un disfraz se lo
 * pone o se lo quita (uno por sitio); tocar un fondo o una animación la elige. Lo que no tienes
 * está en la tienda, a la que se llega desde abajo.
 */
export default function CustomizeScreen() {
  const colors = useThemeColors();
  const progress = useProgress();
  const [tab, setTab] = useState<WardrobeTab>('accesorio');
  const ofKind = CATALOG.filter((item) => item.kind === tab);
  const mine = ofKind.filter((item) => progress.owned.includes(item.id));
  const missing = ofKind.length - mine.length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Fitting state={progress} trying={null}>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Toca lo que quieras ponerle.</Text>
      </Fitting>

      <SegmentedControl options={WARDROBE_TABS} value={tab} onChange={setTab} />

      {mine.length === 0 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {`Aún no tienes ningún ${KIND_LABEL[tab]}. Consíguelos en la tienda o subiendo de nivel.`}
        </Text>
      ) : (
        <ItemGrid
          tab={tab}
          items={mine}
          renderItem={(item) => {
            const inUse = isInUse(item, progress);
            return (
              <ItemTile
                key={item.id}
                item={item}
                selected={inUse}
                foot={{
                  kind: 'text',
                  text: inUse ? (item.kind === 'accesorio' ? 'Puesto' : 'En uso') : 'Tuyo',
                  highlight: inUse,
                }}
                onPress={() => selectItem(item.id)}
              />
            );
          }}
        />
      )}

      <Pressable
        onPress={() => router.push('/progreso/tienda')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.shopLink,
          {
            backgroundColor: colors.primarySoft,
            borderColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="storefront-outline" size={22} color={colors.primary} />
        <View style={styles.shopTexts}>
          <Text style={[styles.shopTitle, { color: colors.text }]}>Ir a la tienda</Text>
          <Text style={[styles.shopDetail, { color: colors.textMuted }]}>
            {missing > 0
              ? `Te faltan ${missing} ${tab === 'accesorio' ? 'disfraces' : tab === 'fondo' ? 'fondos' : 'animaciones'} por conseguir`
              : '¡Lo tienes todo de este tipo!'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  hint: { ...proseFont(15, 21), textAlign: 'center' },
  shopLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: shape.card,
    borderWidth: 1,
  },
  shopTexts: { flex: 1, gap: 2 },
  shopTitle: { fontFamily: fonts.title, fontSize: 16 },
  shopDetail: { fontFamily: fonts.detail, fontSize: 13 },
});
