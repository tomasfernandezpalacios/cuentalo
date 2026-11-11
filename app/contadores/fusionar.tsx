import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import type { CounterWithTotal } from '@/features/contadores/api';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { EmojiPicker } from '@/features/contadores/components/EmojiPicker';
import { useCounterList, useMergeCounters } from '@/features/contadores/hooks';
import { getErrorMessage } from '@/lib/errors';
import { formatWithUnit } from '@/lib/format';
import { fonts, proseFont, titleFont, useThemeColors } from '@/lib/theme';
import { LIMITS } from '@/lib/validation';

/** Quita tildes y mayúsculas para buscar «cafe» y encontrar «Café». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Pantalla completa para fusionar dos o más contadores en uno. */
export default function MergeCountersScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const counters = useCounterList();
  const merge = useMergeCounters();
  // ?contadores=id1,id2 llega desde la selección de la pantalla principal.
  const { contadores } = useLocalSearchParams<{ contadores?: string }>();
  const [selected, setSelected] = useState<string[]>(contadores ? contadores.split(',') : []);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  // Se pueden fusionar los míos y los de mis grupos, salvo los comunes.
  const candidates = (counters.data ?? [])
    .filter((c) => c.isActive && !c.is_common && !c.linkedInto)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const visible = query.trim()
    ? candidates.filter((c) => normalize(c.name).includes(normalize(query.trim())))
    : candidates;

  const chosen = selected
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is CounterWithTotal => c !== undefined);
  const groupCounter = chosen.find((c) => c.group_id !== null);
  // El que queda: el primero de grupo elegido si hay alguno; si no, el primero elegido.
  const target = groupCounter ?? chosen[0];
  // Grupos ya cubiertos por lo elegido: no se pueden juntar dos contadores del mismo grupo.
  const chosenGroupIds = new Set(chosen.flatMap((c) => c.linkedGroups.map((g) => g.group.id)));
  const chosenGroupNames = [
    ...new Set(chosen.flatMap((c) => c.linkedGroups.map((g) => g.group.name))),
  ];

  function toggle(counter: CounterWithTotal) {
    if (selected.includes(counter.id)) {
      setSelected((s) => s.filter((id) => id !== counter.id));
    } else {
      setSelected((s) => [...s, counter.id]);
    }
  }

  function confirmMerge() {
    if (!target || chosen.length < 2) return;
    const finalName = name.trim() || target.name;
    const message =
      chosenGroupNames.length > 0
        ? `Quedará un solo contador, «${finalName}», que cuenta en ${chosenGroupNames.join(' y ')}. ` +
          'En tus estadísticas se suma todo lo que llevabas; en cada grupo solo cuenta lo que ya ' +
          'tenía allí y lo que sumes a partir de ahora.\n\n' +
          `El contador pasará a ser visible para todos los miembros de ${chosenGroupNames.join(' y ')}, ` +
          'sean o no tus amigos.'
        : `Quedará un solo contador, «${finalName}», con todos los registros juntos.`;
    appAlert(
      'Fusionar contadores',
      `${message}\n\nNo se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fusionar',
          onPress: () =>
            merge.mutate(
              { ids: [target.id, ...selected.filter((id) => id !== target.id)], name, emoji },
              {
                onSuccess: (id) => router.replace({ pathname: '/contadores/[id]', params: { id } }),
                onError: (error) => appAlert('No se ha podido fusionar', getErrorMessage(error)),
              },
            ),
        },
      ],
      { warning: true },
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Fusionar contadores' }} />
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              Une dos o más contadores que cuentan lo mismo para tener uno solo. En tus estadísticas
              se suma todo. Si hay contadores de grupos, en cada grupo solo cuenta lo que ya tenía
              allí y lo que sumes después. Puedes unir varios grupos, pero no dos contadores del
              mismo grupo.
            </Text>
            <View
              style={[
                styles.search,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar contador"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Buscar contador"
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            <Text style={[styles.detail, { color: colors.text }]}>
              Elige los contadores ({selected.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const checked = selected.includes(item.id);
          // No se pueden juntar dos contadores del mismo grupo.
          const blocked = !checked && item.linkedGroups.some((g) => chosenGroupIds.has(g.group.id));
          return (
            <Pressable
              onPress={() => toggle(item)}
              disabled={blocked}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: blocked }}
              accessibilityLabel={item.name}
              style={[styles.row, { borderBottomColor: colors.border, opacity: blocked ? 0.4 : 1 }]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={24}
                color={checked ? colors.primary : colors.textMuted}
              />
              <CounterAvatar
                emoji={item.emoji}
                name={item.name}
                photoPath={item.photo_path}
                size={36}
              />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.small, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.linkedGroups.length > 0
                    ? `👥 ${item.linkedGroups.map((g) => g.group.name).join(' · ')} · `
                    : 'Individual · '}
                  {formatWithUnit(item.myTotal, item.unit)}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          chosen.length >= 2 && target ? (
            <View style={styles.footer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Contador resultante</Text>
              <TextField
                label={groupCounter ? 'Nombre (solo lo verás tú)' : 'Nombre'}
                value={name}
                onChangeText={setName}
                placeholder={target.name}
                maxLength={LIMITS.counterName}
              />
              <EmojiPicker value={emoji} onChange={setEmoji} />
              <Text style={[styles.small, { color: colors.textMuted }]}>
                Si no cambias nada, se queda con el nombre y el icono de «{target.name}».
              </Text>
            </View>
          ) : undefined
        }
      />
      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <AppButton
          title={chosen.length >= 2 ? `Fusionar ${chosen.length} contadores` : 'Elige al menos dos'}
          onPress={confirmMerge}
          disabled={chosen.length < 2}
          loading={merge.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 24 },
  header: { gap: 12, marginBottom: 4 },
  detail: { ...proseFont(15, 21) },
  small: { fontSize: 13, fontFamily: fonts.detail },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 16, fontFamily: fonts.title },
  footer: { gap: 14, marginTop: 20 },
  sectionTitle: { ...titleFont(18) },
  bottom: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
